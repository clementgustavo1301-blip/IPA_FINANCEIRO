-- 1. Garantir que todos os valores enum existam em status_ipa
alter type public.status_ipa add value if not exists 'Aguardando NF';
alter type public.status_ipa add value if not exists 'Concluído';
alter type public.status_ipa add value if not exists 'Pendente Aprovação';

-- 2. Habilitar REPLICA IDENTITY FULL para que o Realtime envie todos os dados anteriores no payload.old
alter table public.solicitacoes replica identity full;

-- 3. Remover políticas antigas ou conflitantes de UPDATE na tabela solicitacoes
drop policy if exists "IPA pode editar rascunhos" on public.solicitacoes;
drop policy if exists "Financeiro pode processar pagamentos" on public.solicitacoes;
drop policy if exists "IPA pode enviar NF" on public.solicitacoes;
drop policy if exists "Permitir update solicitacoes" on public.solicitacoes;
drop policy if exists "Financeiro e IPA podem atualizar solicitacoes" on public.solicitacoes;
drop policy if exists "Usuarios autorizados podem atualizar solicitacoes" on public.solicitacoes;
drop policy if exists "Financeiro pode atualizar solicitacoes" on public.solicitacoes;
drop policy if exists "IPA pode atualizar solicitacoes" on public.solicitacoes;

-- 4. Criar política de UPDATE permissiva para perfis autorizados (Financeiro, IPA, Admin)
-- Permite que Financeiro altere status_financeiro (Pago/Pendente) e status_ipa sem violar RLS
create policy "Usuarios autorizados podem atualizar solicitacoes" on public.solicitacoes
for update to authenticated
using (
  public.get_my_role() in ('ipa', 'financeiro', 'admin')
)
with check (
  public.get_my_role() in ('ipa', 'financeiro', 'admin')
);

-- 5. Atualizar política de SELECT para garantir visualização correta
drop policy if exists "Visibilidade de Solicitacoes" on public.solicitacoes;

create policy "Visibilidade de Solicitacoes" on public.solicitacoes
for select to authenticated
using (
  (public.get_my_role() in ('ipa', 'admin'))
  or 
  (public.get_my_role() = 'financeiro')
  or 
  (public.get_my_role() = 'empresa')
);

-- 6. Atualizar política de INSERT
drop policy if exists "IPA pode criar solicitacoes" on public.solicitacoes;
drop policy if exists "Usuarios podem criar solicitacoes" on public.solicitacoes;

create policy "Usuarios podem criar solicitacoes" on public.solicitacoes
for insert to authenticated
with check (
  public.get_my_role() in ('ipa', 'empresa', 'admin')
);
