-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enum types for status
create type status_ipa as enum ('Rascunho', 'Enviado');
create type status_financeiro as enum ('Pendente', 'Pago', 'Cancelado');

-- Clinicas
create table public.clinicas (
    id uuid primary key default uuid_generate_v4(),
    nome text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Empresas Clientes
create table public.empresas_clientes (
    id uuid primary key default uuid_generate_v4(),
    nome text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Solicitacoes
create table public.solicitacoes (
    id uuid primary key default uuid_generate_v4(),
    visual_id serial not null,
    clinica_id uuid references public.clinicas(id) on delete restrict,
    empresa_cliente_id uuid references public.empresas_clientes(id) on delete restrict,
    estado varchar(2) not null,
    cidade text not null,
    qtd_colaboradores integer not null default 0,
    valor numeric(10, 2) not null default 0.00,
    status_ipa status_ipa not null default 'Rascunho',
    status_financeiro status_financeiro not null default 'Pendente',
    comprovante_url text,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Colaboradores attached to a request
create table public.colaboradores_solicitacao (
    id uuid primary key default uuid_generate_v4(),
    solicitacao_id uuid references public.solicitacoes(id) on delete cascade not null,
    nome text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index idx_solicitacoes_status_ipa on public.solicitacoes(status_ipa);
create index idx_solicitacoes_status_financeiro on public.solicitacoes(status_financeiro);
create index idx_solicitacoes_clinica on public.solicitacoes(clinica_id);

-- RLS (Row Level Security) - basic setup for future expansion
alter table public.clinicas enable row level security;
alter table public.empresas_clientes enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.colaboradores_solicitacao enable row level security;

-- For now, allow authenticated users to read/write everything (since we will refine security later as requested)
create policy "Allow all authenticated users" on public.clinicas for all to authenticated using (true);
create policy "Allow all authenticated users" on public.empresas_clientes for all to authenticated using (true);
create policy "Allow all authenticated users" on public.solicitacoes for all to authenticated using (true);
create policy "Allow all authenticated users" on public.colaboradores_solicitacao for all to authenticated using (true);
-- 1. RBAC (Role-Based Access Control)
create type user_role as enum ('ipa', 'financeiro', 'admin');

create table public.user_roles (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role user_role not null default 'ipa',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id)
);

-- Habilitar RLS na tabela de roles
alter table public.user_roles enable row level security;
-- Usuários podem ver a própria role
create policy "Usuários podem ver a própria role" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- Função auxiliar para pegar a role do usuário logado (Security Definer para bypass RLS interno)
create or replace function public.get_my_role() returns user_role as $$
  select role from public.user_roles where user_id = auth.uid();
$$ language sql security definer;

-- 2. Refinando RLS da tabela solicitacoes (Remover as abertas)
drop policy if exists "Allow all authenticated users" on public.solicitacoes;

-- Política SELECT: 
-- IPA vê todas as solicitações. Financeiro vê apenas as que estão 'Enviado'.
create policy "Visibilidade de Solicitacoes" on public.solicitacoes for select to authenticated using (
  (public.get_my_role() = 'ipa') 
  or 
  (public.get_my_role() = 'financeiro' and status_ipa = 'Enviado')
  or 
  (public.get_my_role() = 'admin')
);

-- Política INSERT: Apenas IPA pode criar
create policy "IPA pode criar solicitacoes" on public.solicitacoes for insert to authenticated with check (
  public.get_my_role() = 'ipa'
);

-- Política UPDATE: 
-- IPA só pode atualizar se ainda for Rascunho.
create policy "IPA pode editar rascunhos" on public.solicitacoes for update to authenticated using (
  public.get_my_role() = 'ipa' and status_ipa = 'Rascunho'
) with check (
  public.get_my_role() = 'ipa' and status_ipa = 'Rascunho'
);

-- Financeiro só pode atualizar o status financeiro e comprovante de solicitações enviadas.
create policy "Financeiro pode processar pagamentos" on public.solicitacoes for update to authenticated using (
  public.get_my_role() = 'financeiro' and status_ipa = 'Enviado'
);

-- 3. Validação de Entrada (Check Constraints)
alter table public.solicitacoes add constraint chk_valor_positivo check (valor > 0);
alter table public.solicitacoes add constraint chk_qtd_colaboradores check (qtd_colaboradores >= 0);

-- 4. Auditoria (Audit Trail)
create table public.audit_logs (
    id uuid primary key default uuid_generate_v4(),
    table_name text not null,
    record_id uuid not null,
    action text not null, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data jsonb,
    new_data jsonb,
    changed_by uuid references auth.users(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.audit_logs enable row level security;
-- Apenas admins podem ler logs, ninguém pode inserir manualmente (só trigger)
create policy "Apenas admins leem logs" on public.audit_logs for select to authenticated using (public.get_my_role() = 'admin');

-- Função Trigger para Auditoria
create or replace function public.log_audit_event() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (table_name, record_id, action, new_data, changed_by)
    values (tg_table_name::text, new.id, tg_op, row_to_json(new)::jsonb, auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name::text, new.id, tg_op, row_to_json(old)::jsonb, row_to_json(new)::jsonb, auth.uid());
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_logs (table_name, record_id, action, old_data, changed_by)
    values (tg_table_name::text, old.id, tg_op, row_to_json(old)::jsonb, auth.uid());
    return old;
  end if;
end;
$$ language plpgsql security definer;

-- Aplicar o Trigger na tabela de solicitacoes
create trigger solicitacoes_audit
  after insert or update or delete on public.solicitacoes
  for each row execute function public.log_audit_event();
-- Adicionando campos de pessoa jurídica na tabela clinicas
alter table public.clinicas
add column cnpj varchar(14) unique,
add column razao_social text,
add column cep varchar(8),
add column logradouro text,
add column numero varchar(20),
add column bairro text,
add column cidade text,
add column estado varchar(2),
add column telefone varchar(20),
add column email text;

-- Adicionando campos de pessoa jurídica na tabela empresas_clientes
alter table public.empresas_clientes
add column cnpj varchar(14) unique,
add column razao_social text,
add column cep varchar(8),
add column logradouro text,
add column numero varchar(20),
add column bairro text,
add column cidade text,
add column estado varchar(2),
add column telefone varchar(20),
add column email text;
-- 1. Create an enum for user status
create type user_status as enum ('pendente', 'aprovado', 'rejeitado');

-- 2. Add status column to user_roles table
alter table public.user_roles 
add column status user_status not null default 'pendente';

-- 3. Update the auxiliary function to only return the role if approved
create or replace function public.get_my_status() returns user_status as $$
  select status from public.user_roles where user_id = auth.uid();
$$ language sql security definer;

-- We modify get_my_role() so it only returns a role if the user is APPROVED.
-- This immediately locks out 'pendente' users from all SELECT/UPDATE policies that rely on get_my_role().
create or replace function public.get_my_role() returns user_role as $$
  select role from public.user_roles where user_id = auth.uid() and status = 'aprovado';
$$ language sql security definer;

-- 4. RLS for user_roles so IPA can see pending users and approve them
drop policy if exists "Usuários podem ver a própria role" on public.user_roles;

-- New Policies for user_roles
-- A user can see their own role, OR if the user is an APPROVED IPA, they can see everyone's role (to approve them)
create policy "Visibilidade de Roles" on public.user_roles for select to authenticated using (
  (user_id = auth.uid()) or (public.get_my_role() = 'ipa')
);

-- Only APPROVED IPA can update user_roles (to change status from 'pendente' to 'aprovado' and set their role)
create policy "IPA pode gerenciar acessos" on public.user_roles for update to authenticated using (
  public.get_my_role() = 'ipa'
);
