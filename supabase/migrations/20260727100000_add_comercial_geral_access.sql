update public.usuarios
set paginas_acesso = array_append(paginas_acesso, '/comercial-geral')
where perfil in ('lider', 'diretora', 'admin')
  and not ('/comercial-geral' = any(paginas_acesso));

comment on column public.usuarios.paginas_acesso is
  'Rotas do app liberadas para o usuário. Ex.: /corretor, /roletas, /comercial-geral, /auditorias, /dashboard, /configuracoes.';
