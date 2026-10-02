-- Add data_atendimento to solicitacoes
alter table public.solicitacoes
add column data_atendimento date;

-- Create storage bucket for comprovantes
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- Set up RLS for the storage bucket
create policy "IPA and Financeiro can access comprovantes" on storage.objects
for all to authenticated
using ( bucket_id = 'comprovantes' )
with check ( bucket_id = 'comprovantes' );
