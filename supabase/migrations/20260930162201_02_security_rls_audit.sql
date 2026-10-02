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
