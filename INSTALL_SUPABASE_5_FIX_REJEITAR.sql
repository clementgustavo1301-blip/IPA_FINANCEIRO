-- FIX: Quando um usuário rejeitado faz signup novamente, o trigger precisa
-- resetar o status para 'pendente' ao invés de falhar silenciosamente.
-- O Supabase pode reusar o mesmo auth.users.id ou criar um novo.

-- 1. Atualizar o trigger para lidar com conflito (user_id já existente)
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

-- 2. Correção imediata: Resetar manualmente todos os usuários rejeitados para pendente
-- para que apareçam novamente na tela de aprovação.
-- (Descomente a linha abaixo se quiser aplicar agora)
UPDATE public.user_roles SET status = 'pendente' WHERE status = 'rejeitado';
