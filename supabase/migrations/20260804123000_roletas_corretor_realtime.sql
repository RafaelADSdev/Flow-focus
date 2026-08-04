-- Permissões de roleta refletem na carteira do corretor sem recarregar manualmente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'roletas_corretor'
  ) then
    alter publication supabase_realtime add table public.roletas_corretor;
  end if;
end;
$$;
