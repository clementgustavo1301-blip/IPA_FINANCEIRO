-- Trigger Function for auto-assigning pending status and role
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  -- Lê a role escolhida pelo usuário durante o signup
  requested_role public.user_role;
begin
  -- Pega do user_metadata (enviado pelo frontend). Se não vier, assume 'ipa'
  requested_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    'ipa'::public.user_role
  );

  insert into public.user_roles (user_id, role, status)
  values (new.id, requested_role, 'pendente');

  return new;
end;
$$;

-- Remove the trigger se ele já existe
drop trigger if exists on_auth_user_created on auth.users;

-- Create the trigger on auth.users table
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.on_auth_user_created();
