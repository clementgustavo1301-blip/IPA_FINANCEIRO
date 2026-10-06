-- Enable Realtime for the solicitacoes table so clients can receive updates
begin;
  -- Remove the table from publication if it already exists to avoid errors, then add it back
  -- Actually, the safest way in Supabase is just to add it if it doesn't exist
  do $$
  begin
      if not exists (
          select 1
          from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'solicitacoes'
      ) then
          alter publication supabase_realtime add table solicitacoes;
      end if;
  end;
  $$;
commit;
