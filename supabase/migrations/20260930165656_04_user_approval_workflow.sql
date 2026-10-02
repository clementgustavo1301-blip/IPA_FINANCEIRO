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
