drop policy if exists diretoria_gerencia_usuarios on public.usuarios;

create policy admin_gerencia_usuarios on public.usuarios
for all
to authenticated
using (private.perfil_atual() = 'admin')
with check (private.perfil_atual() = 'admin');
