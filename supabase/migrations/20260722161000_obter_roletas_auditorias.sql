create or replace function public.obter_config_roletas()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_equipe_nome text;
  v_roletas jsonb;
  v_corretores jsonb;
begin
  if private.perfil_atual() not in ('lider', 'diretora', 'admin') then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  select e.nome into v_equipe_nome
  from public.equipes e
  where e.id = private.equipe_atual();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'nome', r.nome,
      'disponiveis', (
        select count(*)::int
        from public.oportunidades o
        where o.roleta_id = r.id and o.status = 'disponivel'
      )
    )
    order by r.nome
  ), '[]'::jsonb)
  into v_roletas
  from public.roletas r
  where r.ativa;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'email', u.email,
      'roletas', coalesce((
        select jsonb_agg(rc.roleta_id::text)
        from public.roletas_corretor rc
        where rc.corretor_id = u.id
      ), '[]'::jsonb),
      'status', case
        when exists (
          select 1 from public.bloqueios b
          where b.corretor_id = u.id and b.liberado_em is null
        ) then 'bloqueado'
        when exists (
          select 1 from public.auditorias a
          where a.corretor_id = u.id and a.status = 'pendente'
        ) then 'auditoria'
        else 'liberado'
      end
    )
    order by u.nome
  ), '[]'::jsonb)
  into v_corretores
  from public.usuarios u
  where u.perfil = 'corretor'
    and u.ativo
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  return jsonb_build_object(
    'equipe_nome', coalesce(v_equipe_nome, 'Equipe'),
    'roletas', v_roletas,
    'corretores', v_corretores,
    'gerado_em', now()
  );
end;
$$;

create or replace function public.obter_painel_auditorias()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_inicio_semana timestamptz := date_trunc('week', now());
  v_inicio_semana_anterior timestamptz := date_trunc('week', now()) - interval '7 days';
  v_aguardando integer;
  v_aprovadas integer;
  v_bloqueados integer;
  v_tempo_medio numeric;
  v_tempo_anterior numeric;
  v_fila jsonb;
begin
  if private.perfil_atual() not in ('lider', 'diretora', 'admin') then
    raise exception 'perfil_sem_permissao' using errcode = '42501';
  end if;

  select count(*) into v_aguardando
  from public.auditorias a
  join public.usuarios u on u.id = a.corretor_id
  where a.status = 'pendente'
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  select count(*) into v_aprovadas
  from public.auditorias a
  join public.usuarios u on u.id = a.corretor_id
  where a.status = 'aprovado'
    and a.concluida_em >= v_inicio_semana
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  select count(distinct b.corretor_id) into v_bloqueados
  from public.bloqueios b
  join public.usuarios u on u.id = b.corretor_id
  where b.liberado_em is null
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  select round(coalesce(avg(extract(epoch from (a.concluida_em - a.data)) / 3600), 0)::numeric, 1)
  into v_tempo_medio
  from public.auditorias a
  join public.usuarios u on u.id = a.corretor_id
  where a.concluida_em is not null
    and a.concluida_em >= v_inicio_semana
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  select round(coalesce(avg(extract(epoch from (a.concluida_em - a.data)) / 3600), 0)::numeric, 1)
  into v_tempo_anterior
  from public.auditorias a
  join public.usuarios u on u.id = a.corretor_id
  where a.concluida_em is not null
    and a.concluida_em >= v_inicio_semana_anterior
    and a.concluida_em < v_inicio_semana
    and (
      private.perfil_atual() in ('diretora', 'admin')
      or u.equipe_id = private.equipe_atual()
    );

  select coalesce(jsonb_agg(row_data order by espera_minutos desc), '[]'::jsonb)
  into v_fila
  from (
    select
      jsonb_build_object(
        'id', a.id,
        'corretor_id', u.id,
        'corretor', u.nome,
        'equipe', coalesce(u.equipe_nome, 'Sem equipe'),
        'capturados', coalesce(c.quantidade_captada, 0),
        'atualizados', (
          select count(*)::int
          from public.oportunidades o
          where o.corretor_id = u.id
            and o.captada_em::date = current_date
            and o.status in ('em_trabalho', 'convertida', 'perdida')
        ),
        'sem_contato', greatest(
          coalesce(c.quantidade_captada, 0) - (
            select count(*)::int
            from public.oportunidades o
            where o.corretor_id = u.id
              and o.captada_em::date = current_date
              and o.status in ('em_trabalho', 'convertida', 'perdida')
          ),
          0
        ),
        'ultima_captura', (
          select max(o.captada_em)
          from public.oportunidades o
          where o.corretor_id = u.id
        ),
        'espera_minutos', greatest(floor(extract(epoch from (now() - a.data)) / 60)::int, 0)
      ) as row_data,
      greatest(floor(extract(epoch from (now() - a.data)) / 60)::int, 0) as espera_minutos
    from public.auditorias a
    join public.usuarios u on u.id = a.corretor_id
    left join public.capturas_diarias c on c.corretor_id = u.id and c.data = current_date
    where a.status = 'pendente'
      and (
        private.perfil_atual() in ('diretora', 'admin')
        or u.equipe_id = private.equipe_atual()
      )
    order by a.data asc
  ) fila;

  return jsonb_build_object(
    'aguardando', coalesce(v_aguardando, 0),
    'aprovadas_semana', coalesce(v_aprovadas, 0),
    'bloqueados', coalesce(v_bloqueados, 0),
    'tempo_medio_horas', coalesce(v_tempo_medio, 0),
    'tempo_medio_variacao_min', round((coalesce(v_tempo_anterior, v_tempo_medio) - coalesce(v_tempo_medio, 0)) * 60)::int,
    'fila', v_fila,
    'gerado_em', now()
  );
end;
$$;

revoke all on function public.obter_config_roletas() from public;
grant execute on function public.obter_config_roletas() to authenticated;

revoke all on function public.obter_painel_auditorias() from public;
grant execute on function public.obter_painel_auditorias() to authenticated;
