do $$
declare
  v_coluna_ja_existia boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'paginas_acesso'
  ) into v_coluna_ja_existia;

  alter table public.usuarios
    add column if not exists paginas_acesso text[] not null default array['/corretor']::text[];

  -- Existing projects may already have per-user access configured. Only seed
  -- role defaults when this migration actually creates the column.
  if not v_coluna_ja_existia then
    update public.usuarios
    set paginas_acesso = case perfil
      when 'corretor' then array['/corretor']::text[]
      when 'lider' then array['/roletas', '/auditorias', '/dashboard']::text[]
      when 'diretora' then array['/roletas', '/auditorias', '/dashboard']::text[]
      when 'admin' then array['/corretor', '/roletas', '/auditorias', '/dashboard', '/configuracoes']::text[]
      else array['/corretor']::text[]
    end;
  end if;
end;
$$;

comment on column public.usuarios.paginas_acesso is
  'Rotas do app liberadas para o usuário. Ex.: /corretor, /roletas, /auditorias, /dashboard, /configuracoes.';
