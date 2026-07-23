create or replace function private.perfil_atual()
returns public.perfil_usuario
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select coalesce(
    (select perfil from public.usuarios where id = (select auth.uid()) and ativo),
    (select (raw_app_meta_data ->> 'perfil')::public.perfil_usuario from auth.users where id = (select auth.uid())),
    'corretor'::public.perfil_usuario
  );
$$;

create or replace function private.equipe_atual()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select equipe_id from public.usuarios where id = (select auth.uid()) and ativo;
$$;

drop policy if exists usuarios_leem_proprio_perfil on public.usuarios;
create policy usuarios_leem_proprio_perfil on public.usuarios
for select to authenticated
using (id = (select auth.uid()));
