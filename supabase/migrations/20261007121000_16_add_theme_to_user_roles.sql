-- Adicionar coluna theme às preferências do usuário na tabela user_roles
alter table public.user_roles
add column if not exists theme text not null default 'dark';
