-- Criação do gatilho para inserir automaticamente o usuário na tabela user_roles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role, status)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::user_role, 'ipa'), 'pendente');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
