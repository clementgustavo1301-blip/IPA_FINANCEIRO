-- Adicionando campo de observação na tabela de solicitações
alter table public.solicitacoes
add column if not exists observacao text;
