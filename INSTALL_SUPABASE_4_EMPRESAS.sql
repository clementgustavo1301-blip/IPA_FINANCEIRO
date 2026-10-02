-- Adiciona a role 'empresa'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'empresa';

-- Adiciona o campo approved_by nas solicitações para rastreio
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS approved_by uuid references auth.users(id) on delete set null;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS solicitado_por_nome text;
ALTER TABLE public.solicitacoes ADD COLUMN IF NOT EXISTS aprovado_por_nome text;

-- Adiciona o status 'Pendente Aprovação'
ALTER TYPE status_ipa ADD VALUE IF NOT EXISTS 'Pendente Aprovação';

-- Adiciona empresa_cliente_id em user_roles para vincular o usuário à empresa
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS empresa_cliente_id uuid references public.empresas_clientes(id);

-- Função para pegar empresa_cliente_id do usuário logado
create or replace function public.get_my_empresa_id() returns uuid as $$
  select empresa_cliente_id from public.user_roles where user_id = auth.uid() and status = 'aprovado';
$$ language sql security definer;

-- Atualizar Políticas (RLS) para 'solicitacoes'
drop policy if exists "Visibilidade de Solicitacoes" on public.solicitacoes;

create policy "Visibilidade de Solicitacoes" on public.solicitacoes for select to authenticated using (
  (public.get_my_role() = 'ipa') 
  or 
  (public.get_my_role() = 'financeiro' and status_ipa in ('Enviado', 'Aguardando NF', 'Concluído'))
  or 
  (public.get_my_role() = 'admin')
  or
  (public.get_my_role() = 'empresa' and empresa_cliente_id = public.get_my_empresa_id())
);

drop policy if exists "IPA pode criar solicitacoes" on public.solicitacoes;

create policy "Criacao de Solicitacoes" on public.solicitacoes for insert to authenticated with check (
  public.get_my_role() = 'ipa'
  or
  (public.get_my_role() = 'empresa' and empresa_cliente_id = public.get_my_empresa_id() and status_ipa = 'Pendente Aprovação')
);

drop policy if exists "IPA pode editar rascunhos" on public.solicitacoes;

create policy "Edicao de Solicitacoes" on public.solicitacoes for update to authenticated using (
  (public.get_my_role() = 'ipa' and status_ipa in ('Rascunho', 'Pendente Aprovação'))
  or
  (public.get_my_role() = 'empresa' and empresa_cliente_id = public.get_my_empresa_id() and status_ipa = 'Pendente Aprovação')
) with check (
  (public.get_my_role() = 'ipa' and status_ipa in ('Rascunho', 'Pendente Aprovação'))
  or
  (public.get_my_role() = 'empresa' and empresa_cliente_id = public.get_my_empresa_id() and status_ipa = 'Pendente Aprovação')
);

-- Atualiza a função handle_new_user para aceitar a role 'empresa'
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role, status)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::user_role, 'ipa'), 'pendente');
  return new;
end;
$$ language plpgsql security definer;
