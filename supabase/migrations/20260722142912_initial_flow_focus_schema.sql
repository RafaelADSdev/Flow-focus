create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;

create type public.perfil_usuario as enum ('corretor', 'lider', 'diretora', 'admin');
create type public.status_oportunidade as enum ('disponivel', 'captada', 'em_trabalho', 'convertida', 'perdida');
create type public.status_auditoria as enum ('pendente', 'aprovado', 'reprovado');

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  lider_id uuid,
  criada_em timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil public.perfil_usuario not null default 'corretor',
  equipe_id uuid references public.equipes(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.equipes add constraint equipes_lider_id_fkey
  foreign key (lider_id) references public.usuarios(id) on delete set null;

create table public.roletas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  bitrix_funil_id text not null unique,
  descricao text,
  ativa boolean not null default true,
  criada_em timestamptz not null default now()
);

create table public.roletas_corretor (
  roleta_id uuid not null references public.roletas(id) on delete cascade,
  corretor_id uuid not null references public.usuarios(id) on delete cascade,
  liberado_por uuid not null references public.usuarios(id),
  liberado_em timestamptz not null default now(),
  primary key (roleta_id, corretor_id)
);

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  bitrix_deal_id text not null unique,
  roleta_id uuid not null references public.roletas(id),
  corretor_id uuid references public.usuarios(id) on delete set null,
  titulo text,
  valor numeric(14, 2) check (valor is null or valor >= 0),
  status public.status_oportunidade not null default 'disponivel',
  captada_em timestamptz,
  ultima_atualizacao_bitrix timestamptz,
  criado_em timestamptz not null default now(),
  constraint oportunidade_captura_consistente check (
    (status = 'disponivel' and corretor_id is null and captada_em is null)
    or status <> 'disponivel'
  )
);

create index oportunidades_disponiveis_idx on public.oportunidades (roleta_id, criado_em)
  where status = 'disponivel';
create index oportunidades_corretor_idx on public.oportunidades (corretor_id, captada_em desc);

create table public.capturas_diarias (
  corretor_id uuid not null references public.usuarios(id) on delete cascade,
  data date not null default current_date,
  quantidade_captada integer not null default 0 check (quantidade_captada >= 0),
  limite_do_dia integer not null default 6 check (limite_do_dia > 0),
  atualizado_em timestamptz not null default now(),
  primary key (corretor_id, data),
  constraint captura_dentro_do_limite check (quantidade_captada <= limite_do_dia)
);

create table public.auditorias (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references public.usuarios(id),
  lider_id uuid not null references public.usuarios(id),
  data timestamptz not null default now(),
  status public.status_auditoria not null default 'pendente',
  observacoes text,
  criterios_avaliados jsonb not null default '[]'::jsonb,
  concluida_em timestamptz,
  constraint auditoria_conclusao_consistente check (
    (status = 'pendente' and concluida_em is null)
    or (status <> 'pendente' and concluida_em is not null)
  )
);

create unique index auditoria_pendente_por_corretor_idx on public.auditorias (corretor_id)
  where status = 'pendente';

create table public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references public.usuarios(id) on delete cascade,
  motivo text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz,
  liberado_em timestamptz,
  liberado_por uuid references public.usuarios(id)
);

create unique index bloqueio_ativo_por_corretor_idx on public.bloqueios (corretor_id)
  where liberado_em is null;

create table public.logs_auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index logs_auditoria_criado_idx on public.logs_auditoria (criado_em desc);
create index logs_auditoria_entidade_idx on public.logs_auditoria (entidade, entidade_id);

create table public.webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'bitrix' check (origem = 'bitrix'),
  idempotency_key text not null unique,
  tipo_evento text not null,
  payload_bruto jsonb not null,
  processado boolean not null default false,
  tentativas smallint not null default 0,
  erro_processamento text,
  processado_em timestamptz,
  criado_em timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.perfil_atual()
returns public.perfil_usuario language sql stable security definer
set search_path = public, pg_temp
as $$ select perfil from public.usuarios where id = (select auth.uid()) and ativo; $$;

create or replace function private.equipe_atual()
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $$ select equipe_id from public.usuarios where id = (select auth.uid()) and ativo; $$;

revoke all on function private.perfil_atual() from public;
revoke all on function private.equipe_atual() from public;
grant execute on function private.perfil_atual() to authenticated;
grant execute on function private.equipe_atual() to authenticated;

create or replace function private.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'perfil')::public.perfil_usuario, 'corretor')
  );
  return new;
end;
$$;

revoke all on function private.criar_perfil_usuario() from public;
create trigger ao_criar_usuario_auth after insert on auth.users
  for each row execute function private.criar_perfil_usuario();

create or replace function private.atualizar_timestamp()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.atualizado_em = now(); return new; end;
$$;

create trigger usuarios_atualizado_em before update on public.usuarios
for each row execute function private.atualizar_timestamp();
create trigger capturas_atualizado_em before update on public.capturas_diarias
for each row execute function private.atualizar_timestamp();

alter table public.equipes enable row level security;
alter table public.usuarios enable row level security;
alter table public.roletas enable row level security;
alter table public.roletas_corretor enable row level security;
alter table public.oportunidades enable row level security;
alter table public.capturas_diarias enable row level security;
alter table public.auditorias enable row level security;
alter table public.bloqueios enable row level security;
alter table public.logs_auditoria enable row level security;
alter table public.webhook_eventos enable row level security;

create policy usuarios_leem_escopo_autorizado on public.usuarios for select to authenticated
using (
  id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and equipe_id = private.equipe_atual())
);

create policy diretoria_gerencia_usuarios on public.usuarios for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

create policy equipes_leitura_autorizada on public.equipes for select to authenticated
using (id = private.equipe_atual() or private.perfil_atual() in ('diretora', 'admin'));

create policy diretoria_gerencia_equipes on public.equipes for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

create policy usuarios_ativos_leem_roletas on public.roletas for select to authenticated
using (private.perfil_atual() is not null);

create policy diretoria_gerencia_roletas on public.roletas for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

create policy atribuicoes_leitura_autorizada on public.roletas_corretor for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual())
  )
);

create policy lideranca_gerencia_atribuicoes on public.roletas_corretor for all to authenticated
using (
  private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and exists (
    select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
  ))
)
with check (
  liberado_por = (select auth.uid())
  and (
    private.perfil_atual() in ('diretora', 'admin')
    or (private.perfil_atual() = 'lider' and exists (
      select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
    ))
  )
);

create policy oportunidades_leitura_autorizada on public.oportunidades for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and exists (
    select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
  ))
);

create policy diretoria_gerencia_oportunidades on public.oportunidades for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

create policy capturas_leitura_autorizada on public.capturas_diarias for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and exists (
    select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
  ))
);

create policy auditorias_leitura_autorizada on public.auditorias for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and exists (
    select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
  ))
);

create policy lideranca_cria_auditorias on public.auditorias for insert to authenticated
with check (
  lider_id = (select auth.uid())
  and (
    private.perfil_atual() in ('diretora', 'admin')
    or (private.perfil_atual() = 'lider' and exists (
      select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
    ))
  )
);

create policy bloqueios_leitura_autorizada on public.bloqueios for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and exists (
    select 1 from public.usuarios u where u.id = corretor_id and u.equipe_id = private.equipe_atual()
  ))
);

create policy logs_leitura_autorizada on public.logs_auditoria for select to authenticated
using (usuario_id = (select auth.uid()) or private.perfil_atual() in ('diretora', 'admin'));

-- Eventos brutos contem segredos do Bitrix e ficam acessiveis apenas via service role.
-- Nenhuma policy e criada para authenticated em webhook_eventos.

create or replace function public.captar_oportunidade(p_roleta_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_captura public.capturas_diarias%rowtype;
  v_oportunidade public.oportunidades%rowtype;
begin
  if v_usuario is null or private.perfil_atual() <> 'corretor' then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  if exists (select 1 from public.bloqueios where corretor_id = v_usuario and liberado_em is null) then
    raise exception 'corretor_bloqueado' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.roletas_corretor rc
    join public.roletas r on r.id = rc.roleta_id and r.ativa
    where rc.corretor_id = v_usuario and rc.roleta_id = p_roleta_id
  ) then
    raise exception 'roleta_nao_autorizada' using errcode = '42501';
  end if;

  insert into public.capturas_diarias (corretor_id, data)
  values (v_usuario, current_date)
  on conflict (corretor_id, data) do nothing;

  select * into v_captura from public.capturas_diarias
  where corretor_id = v_usuario and data = current_date
  for update;

  if v_captura.quantidade_captada >= v_captura.limite_do_dia then
    raise exception 'limite_diario_atingido' using errcode = 'P0001';
  end if;

  select * into v_oportunidade from public.oportunidades
  where roleta_id = p_roleta_id and status = 'disponivel'
  order by criado_em
  for update skip locked
  limit 1;

  if v_oportunidade.id is null then
    raise exception 'roleta_sem_oportunidades' using errcode = 'P0001';
  end if;

  update public.oportunidades
  set corretor_id = v_usuario, status = 'captada', captada_em = now()
  where id = v_oportunidade.id;

  update public.capturas_diarias
  set quantidade_captada = quantidade_captada + 1
  where corretor_id = v_usuario and data = current_date;

  insert into public.logs_auditoria (usuario_id, acao, entidade, entidade_id, payload)
  values (v_usuario, 'oportunidade_captada', 'oportunidade', v_oportunidade.id,
    jsonb_build_object('roleta_id', p_roleta_id));

  return jsonb_build_object(
    'oportunidade_id', v_oportunidade.id,
    'bitrix_deal_id', v_oportunidade.bitrix_deal_id,
    'quantidade_captada', v_captura.quantidade_captada + 1,
    'limite_do_dia', v_captura.limite_do_dia
  );
end;
$$;

revoke all on function public.captar_oportunidade(uuid) from public;
grant execute on function public.captar_oportunidade(uuid) to authenticated;

create or replace function public.concluir_auditoria(
  p_auditoria_id uuid,
  p_status public.status_auditoria,
  p_observacoes text,
  p_criterios jsonb
)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auditoria public.auditorias%rowtype;
  v_usuario uuid := auth.uid();
begin
  if p_status = 'pendente' then
    raise exception 'status_invalido' using errcode = '22023';
  end if;

  select * into v_auditoria from public.auditorias where id = p_auditoria_id for update;
  if v_auditoria.id is null or v_auditoria.status <> 'pendente' then
    raise exception 'auditoria_indisponivel' using errcode = 'P0001';
  end if;

  if not (
    private.perfil_atual() in ('diretora', 'admin')
    or (private.perfil_atual() = 'lider' and exists (
      select 1 from public.usuarios u
      where u.id = v_auditoria.corretor_id and u.equipe_id = private.equipe_atual()
    ))
  ) then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  update public.auditorias
  set status = p_status,
      observacoes = p_observacoes,
      criterios_avaliados = p_criterios,
      concluida_em = now(),
      lider_id = v_usuario
  where id = p_auditoria_id;

  if p_status = 'aprovado' then
    update public.bloqueios set liberado_em = now(), liberado_por = v_usuario
    where corretor_id = v_auditoria.corretor_id and liberado_em is null;
  else
    insert into public.bloqueios (corretor_id, motivo)
    values (v_auditoria.corretor_id, coalesce(nullif(p_observacoes, ''), 'Carteira reprovada na auditoria'))
    on conflict (corretor_id) where liberado_em is null
    do update set motivo = excluded.motivo;
  end if;

  insert into public.logs_auditoria (usuario_id, acao, entidade, entidade_id, payload)
  values (v_usuario, 'auditoria_' || p_status::text, 'auditoria', p_auditoria_id,
    jsonb_build_object('corretor_id', v_auditoria.corretor_id, 'criterios', p_criterios));

  return jsonb_build_object(
    'auditoria_id', p_auditoria_id,
    'status', p_status,
    'corretor_id', v_auditoria.corretor_id
  );
end;
$$;

revoke all on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb) from public;
grant execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb) to authenticated;

create or replace function private.executar_manutencao_diaria()
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.bloqueios
  set liberado_em = now()
  where liberado_em is null and expira_em is not null and expira_em <= now();

  -- capturas_diarias e historica e separada por data. O reset ocorre ao
  -- criar a linha do novo dia, sem destruir o historico de produtividade.
  insert into public.logs_auditoria (acao, entidade, payload)
  values ('manutencao_diaria', 'sistema', jsonb_build_object('executada_em', now()));
end;
$$;

revoke all on function private.executar_manutencao_diaria() from public, anon, authenticated;

select cron.schedule(
  'flow-focus-manutencao-diaria',
  '5 3 * * *',
  $$select private.executar_manutencao_diaria()$$
);

-- A exposicao na Data API e explicita; RLS continua sendo a autorizacao por linha.
grant usage on schema public to authenticated;
grant select on public.equipes, public.usuarios, public.roletas, public.roletas_corretor,
  public.oportunidades, public.capturas_diarias, public.auditorias, public.bloqueios,
  public.logs_auditoria to authenticated;
grant insert, update, delete on public.equipes, public.usuarios, public.roletas,
  public.roletas_corretor, public.oportunidades, public.auditorias to authenticated;
