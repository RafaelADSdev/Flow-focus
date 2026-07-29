-- Reconciles projects where the initial schema objects were provisioned outside
-- the Supabase migration history. This migration is safe on a fresh database too.

do $$
begin
  if to_regtype('public.status_oportunidade') is null then
    create type public.status_oportunidade as enum (
      'disponivel',
      'captada',
      'em_trabalho',
      'convertida',
      'perdida'
    );
  end if;

  if to_regtype('public.status_auditoria') is null then
    create type public.status_auditoria as enum (
      'pendente',
      'aprovado',
      'reprovado'
    );
  end if;
end;
$$;

alter table public.oportunidades
  add column if not exists status public.status_oportunidade;

update public.oportunidades
set status = case
  when upper(coalesce(bitrix_stage_id, '')) ~ '#S($|[^A-Z])'
    or upper(coalesce(bitrix_stage_id, '')) like '%WON%'
    or upper(coalesce(bitrix_stage_id, '')) like '%CONVERT%'
    then 'convertida'::public.status_oportunidade
  when upper(coalesce(bitrix_stage_id, '')) ~ '#F($|[^A-Z])'
    or upper(coalesce(bitrix_stage_id, '')) like '%LOSE%'
    or upper(coalesce(bitrix_stage_id, '')) like '%LOST%'
    or upper(coalesce(bitrix_stage_id, '')) like '%PERD%'
    then 'perdida'::public.status_oportunidade
  when upper(coalesce(bitrix_stage_id, '')) ~ '#P($|[^A-Z])'
    then 'em_trabalho'::public.status_oportunidade
  when corretor_id is null
    then 'disponivel'::public.status_oportunidade
  when ultima_atualizacao_bitrix is not null and captada_em is not null
    then 'em_trabalho'::public.status_oportunidade
  else 'captada'::public.status_oportunidade
end
where status is null;

alter table public.oportunidades
  alter column status set default 'disponivel'::public.status_oportunidade,
  alter column status set not null;

alter table public.auditorias
  add column if not exists status public.status_auditoria;

update public.auditorias a
set status = case
  when a.concluida_em is null then 'pendente'::public.status_auditoria
  when exists (
    select 1
    from public.bloqueios b
    where b.corretor_id = a.corretor_id
      and b.liberado_em is null
      and b.criado_em >= a.data
  ) then 'reprovado'::public.status_auditoria
  else 'aprovado'::public.status_auditoria
end
where status is null;

alter table public.auditorias
  alter column status set default 'pendente'::public.status_auditoria,
  alter column status set not null;

create or replace function public.concluir_auditoria(
  p_auditoria_id uuid,
  p_status public.status_auditoria,
  p_observacoes text,
  p_criterios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auditoria public.auditorias%rowtype;
  v_usuario uuid := auth.uid();
begin
  if p_status = 'pendente' then
    raise exception 'status_invalido' using errcode = '22023';
  end if;

  select * into v_auditoria
  from public.auditorias
  where id = p_auditoria_id
  for update;

  if v_auditoria.id is null or v_auditoria.status <> 'pendente' then
    raise exception 'auditoria_indisponivel' using errcode = 'P0001';
  end if;

  if not (
    private.perfil_atual() in ('diretora', 'admin')
    or (
      private.perfil_atual() = 'lider'
      and exists (
        select 1
        from public.usuarios u
        where u.id = v_auditoria.corretor_id
          and u.equipe_id = private.equipe_atual()
      )
    )
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
    update public.bloqueios
    set liberado_em = now(), liberado_por = v_usuario
    where corretor_id = v_auditoria.corretor_id
      and liberado_em is null;
  else
    insert into public.bloqueios (corretor_id, motivo)
    values (
      v_auditoria.corretor_id,
      coalesce(nullif(p_observacoes, ''), 'Carteira reprovada na auditoria')
    )
    on conflict (corretor_id) where liberado_em is null
    do update set motivo = excluded.motivo;
  end if;

  insert into public.logs_auditoria (usuario_id, acao, entidade, entidade_id, payload)
  values (
    v_usuario,
    'auditoria_' || p_status::text,
    'auditoria',
    p_auditoria_id,
    jsonb_build_object(
      'corretor_id', v_auditoria.corretor_id,
      'criterios', p_criterios
    )
  );

  return jsonb_build_object(
    'auditoria_id', p_auditoria_id,
    'status', p_status,
    'corretor_id', v_auditoria.corretor_id
  );
end;
$$;

revoke all on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb)
  from public;
grant execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb)
  to authenticated;

drop policy if exists usuarios_leem_escopo_autorizado on public.usuarios;
create policy usuarios_leem_escopo_autorizado
on public.usuarios for select to authenticated
using (
  id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (private.perfil_atual() = 'lider' and equipe_id = private.equipe_atual())
);

drop policy if exists diretoria_gerencia_usuarios on public.usuarios;
create policy diretoria_gerencia_usuarios
on public.usuarios for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

drop policy if exists equipes_leitura_autorizada on public.equipes;
create policy equipes_leitura_autorizada
on public.equipes for select to authenticated
using (
  id = private.equipe_atual()
  or private.perfil_atual() in ('diretora', 'admin')
);

drop policy if exists diretoria_gerencia_equipes on public.equipes;
create policy diretoria_gerencia_equipes
on public.equipes for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

drop policy if exists usuarios_ativos_leem_roletas on public.roletas;
create policy usuarios_ativos_leem_roletas
on public.roletas for select to authenticated
using (private.perfil_atual() is not null);

drop policy if exists diretoria_gerencia_roletas on public.roletas;
create policy diretoria_gerencia_roletas
on public.roletas for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

drop policy if exists atribuicoes_leitura_autorizada on public.roletas_corretor;
create policy atribuicoes_leitura_autorizada
on public.roletas_corretor for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
);

drop policy if exists lideranca_gerencia_atribuicoes on public.roletas_corretor;
create policy lideranca_gerencia_atribuicoes
on public.roletas_corretor for all to authenticated
using (
  private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
)
with check (
  liberado_por = (select auth.uid())
  and (
    private.perfil_atual() in ('diretora', 'admin')
    or (
      private.perfil_atual() = 'lider'
      and exists (
        select 1 from public.usuarios u
        where u.id = corretor_id
          and u.equipe_id = private.equipe_atual()
      )
    )
  )
);

drop policy if exists oportunidades_leitura_autorizada on public.oportunidades;
create policy oportunidades_leitura_autorizada
on public.oportunidades for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
);

drop policy if exists diretoria_gerencia_oportunidades on public.oportunidades;
create policy diretoria_gerencia_oportunidades
on public.oportunidades for all to authenticated
using (private.perfil_atual() in ('diretora', 'admin'))
with check (private.perfil_atual() in ('diretora', 'admin'));

drop policy if exists capturas_leitura_autorizada on public.capturas_diarias;
create policy capturas_leitura_autorizada
on public.capturas_diarias for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
);

drop policy if exists auditorias_leitura_autorizada on public.auditorias;
create policy auditorias_leitura_autorizada
on public.auditorias for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
);

drop policy if exists lideranca_cria_auditorias on public.auditorias;
create policy lideranca_cria_auditorias
on public.auditorias for insert to authenticated
with check (
  lider_id = (select auth.uid())
  and (
    private.perfil_atual() in ('diretora', 'admin')
    or (
      private.perfil_atual() = 'lider'
      and exists (
        select 1 from public.usuarios u
        where u.id = corretor_id
          and u.equipe_id = private.equipe_atual()
      )
    )
  )
);

drop policy if exists bloqueios_leitura_autorizada on public.bloqueios;
create policy bloqueios_leitura_autorizada
on public.bloqueios for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and exists (
      select 1 from public.usuarios u
      where u.id = corretor_id
        and u.equipe_id = private.equipe_atual()
    )
  )
);

drop policy if exists logs_leitura_autorizada on public.logs_auditoria;
create policy logs_leitura_autorizada
on public.logs_auditoria for select to authenticated
using (
  usuario_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
);

grant usage on schema public to authenticated;
grant select on
  public.equipes,
  public.usuarios,
  public.roletas,
  public.roletas_corretor,
  public.oportunidades,
  public.capturas_diarias,
  public.auditorias,
  public.bloqueios,
  public.logs_auditoria
to authenticated;
grant insert, update, delete on
  public.equipes,
  public.usuarios,
  public.roletas,
  public.roletas_corretor,
  public.oportunidades,
  public.auditorias
to authenticated;
