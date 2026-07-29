-- One server-managed row defines the active office perimeter.
create table public.geofence_configuracao (
  id smallint primary key default 1 check (id = 1),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  raio_metros integer not null check (raio_metros between 10 and 5000),
  atualizado_por uuid not null references auth.users(id),
  atualizado_em timestamptz not null default now()
);

alter table public.geofence_configuracao enable row level security;
revoke all on table public.geofence_configuracao from public, anon, authenticated;
grant select, insert, update on table public.geofence_configuracao to service_role;

-- History stays outside the Data API and contains every saved perimeter.
create table private.geofence_configuracao_historico (
  id bigint generated always as identity primary key,
  latitude double precision not null,
  longitude double precision not null,
  raio_metros integer not null,
  atualizado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

alter table private.geofence_configuracao_historico enable row level security;
revoke all on table private.geofence_configuracao_historico from public, anon, authenticated;

-- A configuration change immediately invalidates database geo-sessions;
-- signed browser cookies still expire within the configured short window.
create or replace function private.registrar_alteracao_geofence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.latitude is not distinct from old.latitude
    and new.longitude is not distinct from old.longitude
    and new.raio_metros is not distinct from old.raio_metros
  then
    return old;
  end if;

  new.atualizado_em := now();

  insert into private.geofence_configuracao_historico (
    latitude,
    longitude,
    raio_metros,
    atualizado_por,
    criado_em
  ) values (
    new.latitude,
    new.longitude,
    new.raio_metros,
    new.atualizado_por,
    new.atualizado_em
  );

  delete from private.geo_sessions;
  return new;
end;
$$;

revoke all on function private.registrar_alteracao_geofence() from public, anon, authenticated;

create trigger geofence_configuracao_before_write
before insert or update on public.geofence_configuracao
for each row execute function private.registrar_alteracao_geofence();
