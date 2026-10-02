-- 1. Adicionar colunas 'nome' e 'email' na tabela user_roles, caso não existam
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS email text;

-- 2. Atualizar o trigger para lidar com conflito (user_id já existente) e popular nome e email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role, status, nome, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'ipa'),
    'pendente',
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do update set
    status = 'pendente',
    role = coalesce((new.raw_user_meta_data->>'role')::user_role, 'ipa'),
    nome = coalesce(new.raw_user_meta_data->>'nome', excluded.nome),
    email = coalesce(new.email, excluded.email);
  return new;
end;
$$ language plpgsql security definer;

-- 3. Resetar manualmente todos os usuários rejeitados para pendente
UPDATE public.user_roles SET status = 'pendente' WHERE status = 'rejeitado';
