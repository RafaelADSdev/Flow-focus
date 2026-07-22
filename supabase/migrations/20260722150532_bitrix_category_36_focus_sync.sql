alter table public.roletas
  add column if not exists bitrix_category_id text,
  add column if not exists bitrix_roleta_valor text;

alter table public.oportunidades
  add column if not exists roleta_atual text,
  add column if not exists bitrix_stage_id text,
  add column if not exists bitrix_assigned_by_id text,
  add column if not exists data_criacao_bitrix timestamptz;

create unique index if not exists roletas_categoria_valor_idx
  on public.roletas (bitrix_category_id, lower(bitrix_roleta_valor))
  where bitrix_category_id is not null and bitrix_roleta_valor is not null;

drop policy if exists "oportunidades_leitura_autorizada" on public.oportunidades;
create policy "oportunidades_leitura_autorizada" on public.oportunidades for select to authenticated
using (
  corretor_id = (select auth.uid())
  or private.perfil_atual() in ('diretora', 'admin')
  or (
    private.perfil_atual() = 'lider'
    and (
      exists (
        select 1 from public.usuarios u
        where u.id = corretor_id and u.equipe_id = private.equipe_atual()
      )
      or (
        status = 'disponivel'
        and exists (
          select 1
          from public.roletas_corretor rc
          join public.usuarios u on u.id = rc.corretor_id
          where rc.roleta_id = oportunidades.roleta_id
            and u.equipe_id = private.equipe_atual()
        )
      )
    )
  )
);

create or replace function public.obter_dashboard(p_dias integer default 7)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 7), 90));
  v_inicio date;
  v_disponiveis integer;
  v_captadas integer;
  v_trabalhadas integer;
  v_bloqueados integer;
  v_corretores integer;
  v_tempo_medio numeric;
  v_serie jsonb;
  v_capacidade jsonb;
begin
  if private.perfil_atual() not in ('lider', 'diretora', 'admin') then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  v_inicio := current_date - (v_dias - 1);

  select
    count(*) filter (where status = 'disponivel'),
    count(*) filter (where captada_em::date >= v_inicio),
    count(*) filter (
      where ultima_atualizacao_bitrix::date >= v_inicio
        and status in ('em_trabalho', 'convertida', 'perdida')
    )
  into v_disponiveis, v_captadas, v_trabalhadas
  from public.oportunidades;

  select count(*) into v_bloqueados
  from public.bloqueios
  where liberado_em is null;

  select count(*) into v_corretores
  from public.usuarios
  where perfil = 'corretor' and ativo;

  select round(coalesce(avg(extract(epoch from (concluida_em - data)) / 3600), 0)::numeric, 1)
  into v_tempo_medio
  from public.auditorias
  where concluida_em is not null and data::date >= v_inicio;

  select coalesce(jsonb_agg(jsonb_build_object(
    'data', serie.dia::text,
    'captadas', serie.captadas,
    'trabalhadas', serie.trabalhadas
  ) order by serie.dia), '[]'::jsonb)
  into v_serie
  from (
    select
      d.dia::date as dia,
      count(o.id) filter (where o.captada_em::date = d.dia::date) as captadas,
      count(o.id) filter (
        where o.ultima_atualizacao_bitrix::date = d.dia::date
          and o.status in ('em_trabalho', 'convertida', 'perdida')
      ) as trabalhadas
    from generate_series(v_inicio, current_date, interval '1 day') as d(dia)
    left join public.oportunidades o
      on o.captada_em::date = d.dia::date
      or o.ultima_atualizacao_bitrix::date = d.dia::date
    group by d.dia::date
  ) serie;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', capacidade.id,
    'nome', capacidade.nome,
    'capturados', capacidade.capturados,
    'limite', capacidade.limite,
    'status', capacidade.status
  ) order by capacidade.nome), '[]'::jsonb)
  into v_capacidade
  from (
    select
      u.id,
      u.nome,
      coalesce(c.quantidade_captada, 0) as capturados,
      coalesce(c.limite_do_dia, 6) as limite,
      case
        when b.id is not null then 'bloqueado'
        when a.id is not null then 'auditoria'
        else 'liberado'
      end as status
    from public.usuarios u
    left join public.capturas_diarias c on c.corretor_id = u.id and c.data = current_date
    left join public.bloqueios b on b.corretor_id = u.id and b.liberado_em is null
    left join public.auditorias a on a.corretor_id = u.id and a.status = 'pendente'
    where u.perfil = 'corretor' and u.ativo
  ) capacidade;

  return jsonb_build_object(
    'disponiveis', v_disponiveis,
    'captadas_periodo', v_captadas,
    'trabalhadas_periodo', v_trabalhadas,
    'taxa_tratamento', case when v_captadas = 0 then 0 else round((v_trabalhadas::numeric / v_captadas) * 100, 1) end,
    'tempo_medio_auditoria_horas', v_tempo_medio,
    'bloqueados', v_bloqueados,
    'corretores_ativos', v_corretores,
    'serie', v_serie,
    'capacidade', v_capacidade,
    'periodo_dias', v_dias,
    'gerado_em', now()
  );
end;
$$;

revoke all on function public.obter_dashboard(integer) from public;
grant execute on function public.obter_dashboard(integer) to authenticated;
