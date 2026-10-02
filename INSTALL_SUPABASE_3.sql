-- Adiciona novos status para IPA
ALTER TYPE status_ipa ADD VALUE 'Aguardando NF';
ALTER TYPE status_ipa ADD VALUE 'Concluído';

-- Adiciona campos para nota fiscal na tabela solicitacoes
ALTER TABLE public.solicitacoes
ADD COLUMN nota_fiscal_url text,
ADD COLUMN nota_fiscal_size text;

-- Atualizar política RLS para Financeiro ver solicitações em andamento (inclusive as já pagas e aguardando NF)
drop policy if exists "Visibilidade de Solicitacoes" on public.solicitacoes;

create policy "Visibilidade de Solicitacoes" on public.solicitacoes for select to authenticated using (
  (public.get_my_role() = 'ipa') 
  or 
  (public.get_my_role() = 'financeiro' and status_ipa in ('Enviado', 'Aguardando NF', 'Concluído'))
  or 
  (public.get_my_role() = 'admin')
);

drop policy if exists "Financeiro pode processar pagamentos" on public.solicitacoes;

create policy "Financeiro pode processar pagamentos" on public.solicitacoes for update to authenticated using (
  public.get_my_role() = 'financeiro' and status_ipa in ('Enviado', 'Aguardando NF', 'Concluído')
);

-- Nova política para IPA atualizar a Nota Fiscal
create policy "IPA pode enviar NF" on public.solicitacoes for update to authenticated using (
  public.get_my_role() = 'ipa' and status_ipa in ('Aguardando NF', 'Concluído')
);
