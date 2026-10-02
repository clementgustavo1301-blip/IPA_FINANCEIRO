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
