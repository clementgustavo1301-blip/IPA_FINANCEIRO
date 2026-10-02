-- Add nome and email to user_roles
alter table public.user_roles 
add column nome text,
add column email text;

-- Update the trigger function to capture nome and email
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    'ipa'::public.user_role
  );

  insert into public.user_roles (user_id, role, status, nome, email)
  values (
    new.id, 
    requested_role, 
    'pendente',
    new.raw_user_meta_data->>'nome',
    new.email
  );

  return new;
end;
$$;
