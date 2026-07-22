create or replace function public.obter_carteira()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_perfil public.perfil_usuario;
  v_nome text;
  v_capturados integer := 0;
  v_limite integer := 6;
  v_bloqueado boolean := false;
  v_auditoria_pendente boolean := false;
  v_estado text;
  v_roletas jsonb;
  v_capturas jsonb;
begin
  if v_usuario is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select perfil, nome
  into v_perfil, v_nome
  from public.usuarios
  where id = v_usuario and ativo;

  if v_nome is null then
    raise exception 'usuario_nao_encontrado' using errcode = 'P0001';
  end if;

  select coalesce(c.quantidade_captada, 0), coalesce(c.limite_do_dia, 6)
  into v_capturados, v_limite
  from public.capturas_diarias c
  where c.corretor_id = v_usuario and c.data = current_date;

  if not found then
    v_capturados := 0;
    v_limite := 6;
  end if;

  select exists (
    select 1
    from public.bloqueios b
    where b.corretor_id = v_usuario and b.liberado_em is null
  ) into v_bloqueado;

  select exists (
    select 1
    from public.auditorias a
    where a.corretor_id = v_usuario and a.status = 'pendente'
  ) into v_auditoria_pendente;

  if v_bloqueado then
    v_estado := 'bloqueado';
  elsif v_auditoria_pendente or v_capturados >= v_limite then
    v_estado := 'auditoria_pendente';
  else
    v_estado := 'captacao_liberada';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'nome', r.nome,
      'descricao', coalesce(r.descricao, ''),
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
  join public.roletas_corretor rc on rc.roleta_id = r.id
  where rc.corretor_id = v_usuario and r.ativa;

  select coalesce(jsonb_agg(row_data order by captada_em desc), '[]'::jsonb)
  into v_capturas
  from (
    select
      jsonb_build_object(
        'id', o.id,
        'bitrix_deal_id', o.bitrix_deal_id,
        'titulo', coalesce(o.titulo, 'Oportunidade sem titulo'),
        'roleta', r.nome,
        'captada_em', o.captada_em,
        'valor', coalesce(o.valor, 0),
        'status', o.status
      ) as row_data,
      o.captada_em
    from public.oportunidades o
    join public.roletas r on r.id = o.roleta_id
    where o.corretor_id = v_usuario
      and o.captada_em is not null
    order by o.captada_em desc
    limit 10
  ) recentes;

  return jsonb_build_object(
    'nome', v_nome,
    'perfil', v_perfil,
    'capturados', v_capturados,
    'limite', v_limite,
    'estado_ciclo', v_estado,
    'roletas', v_roletas,
    'capturas_recentes', v_capturas,
    'gerado_em', now()
  );
end;
$$;

revoke all on function public.obter_carteira() from public;
grant execute on function public.obter_carteira() to authenticated;
