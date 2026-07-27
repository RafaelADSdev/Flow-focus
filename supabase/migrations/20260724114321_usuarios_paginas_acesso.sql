alter table public.usuarios
  add column if not exists paginas_acesso text[] not null default array['/corretor']::text[];

comment on column public.usuarios.paginas_acesso is
  'Rotas do app liberadas para o usuário. Ex.: /corretor, /roletas, /auditorias, /dashboard, /configuracoes.';

update public.usuarios
set paginas_acesso = case perfil
  when 'corretor' then array['/corretor']::text[]
  when 'lider' then array['/roletas', '/auditorias', '/dashboard']::text[]
  when 'diretora' then array['/roletas', '/auditorias', '/dashboard']::text[]
  when 'admin' then array['/corretor', '/roletas', '/auditorias', '/dashboard', '/configuracoes']::text[]
  else array['/corretor']::text[]
end;
