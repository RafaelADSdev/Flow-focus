-- Rode no SQL Editor do projeto Supabase usado pelo app (.env.local).
-- Corrige tipos e funções que RPCs/RLS dependem (private.perfil_atual, private.equipe_atual).

-- 1) Enum de perfil (pode já existir de tentativa anterior)
do $$ begin
  create type public.perfil_usuario as enum ('corretor', 'lider', 'diretora', 'admin');
exception
  when duplicate_object then null;
end $$;

-- 2) Coluna perfil em usuarios (se a tabela existir sem ela)
alter table public.usuarios
  add column if not exists perfil public.perfil_usuario not null default 'corretor';

-- 3) Schema private
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- 4) Helpers de sessão
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

revoke all on function private.perfil_atual() from public;
revoke all on function private.equipe_atual() from public;
grant execute on function private.perfil_atual() to authenticated;
grant execute on function private.equipe_atual() to authenticated;

-- 5) Leitura do próprio perfil (evita todos entrarem como corretor por RLS)
drop policy if exists usuarios_leem_proprio_perfil on public.usuarios;
create policy usuarios_leem_proprio_perfil on public.usuarios
for select to authenticated
using (id = (select auth.uid()));

notify pgrst, 'reload schema';
