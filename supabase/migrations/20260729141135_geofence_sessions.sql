-- Short territorial session without persisted coordinates. The Next.js API is its only writer.
-- Policies only verify the expiration associated with auth.uid().
create table private.geo_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table private.geo_sessions enable row level security;
revoke all on table private.geo_sessions from public, anon, authenticated;

create index geo_sessions_expires_at_idx on private.geo_sessions (expires_at);

-- Kept in the exposed schema so the Route Handler can call it through PostgREST.
-- The grant and internal check restrict execution to the server service_role.
create or replace function public.registrar_geo_sessao(
  p_user_id uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  insert into private.geo_sessions (user_id, expires_at, updated_at)
  values (p_user_id, least(p_expires_at, now() + interval '5 minutes'), now())
  on conflict (user_id) do update
  set expires_at = excluded.expires_at,
      updated_at = now();

  delete from private.geo_sessions
  where expires_at < now() - interval '1 day';
end;
$$;

revoke all on function public.registrar_geo_sessao(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_geo_sessao(uuid, timestamptz) to service_role;

create or replace function private.geofence_access_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from private.geo_sessions session
      where session.user_id = (select auth.uid())
        and session.expires_at > now()
    );
$$;

revoke all on function private.geofence_access_valid() from public, anon;
grant execute on function private.geofence_access_valid() to authenticated, service_role;

-- RESTRICTIVE policies combine with existing profile and team policies.
-- The territorial rule therefore adds an AND without duplicating the authorization matrix.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'equipes',
    'usuarios',
    'roletas',
    'roletas_corretor',
    'oportunidades',
    'capturas_diarias',
    'auditorias',
    'bloqueios',
    'logs_auditoria',
    'webhook_eventos',
    'broker_exemptions'
  ]
  loop
    execute format('drop policy if exists geofence_requires_office on public.%I', table_name);
    execute format(
      'create policy geofence_requires_office on public.%I as restrictive for all to authenticated using ((select private.geofence_access_valid())) with check ((select private.geofence_access_valid()))',
      table_name
    );
  end loop;
end;
$$;

-- These SECURITY DEFINER RPCs bypass RLS by design. Current flows call them server-side
-- with service_role, after the request passes the territorial check in proxy.ts.
revoke execute on function public.captar_oportunidade(uuid) from authenticated;
revoke execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb) from authenticated;
revoke execute on function public.obter_carteira() from authenticated;
revoke execute on function public.obter_config_roletas() from authenticated;
revoke execute on function public.obter_painel_auditorias() from authenticated;

grant execute on function public.captar_oportunidade(uuid) to service_role;
grant execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb) to service_role;
grant execute on function public.obter_carteira() to service_role;
grant execute on function public.obter_config_roletas() to service_role;
grant execute on function public.obter_painel_auditorias() to service_role;

