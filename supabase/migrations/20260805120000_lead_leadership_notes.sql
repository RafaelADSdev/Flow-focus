-- Observacao da lideranca por lead na auditoria (espelhada no Bitrix UF_CRM_1785940762251).

alter table public.oportunidades
  add column if not exists observacao_lideranca text,
  add column if not exists observacao_lideranca_em timestamptz;

alter table public.oportunidades
  drop constraint if exists oportunidade_observacao_lideranca_limite;

alter table public.oportunidades
  add constraint oportunidade_observacao_lideranca_limite check (
    observacao_lideranca is null
    or char_length(observacao_lideranca) <= 1500
  );

drop function if exists public.salvar_checklist_auditoria(uuid, uuid, jsonb, text);

create or replace function public.salvar_checklist_auditoria(
  p_auditoria_id uuid,
  p_lider_id uuid,
  p_leads jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auditoria public.auditorias%rowtype;
  v_item jsonb;
  v_atendidos boolean;
  v_atualizados integer := 0;
  v_liberados integer := 0;
  v_pendentes integer := 0;
  v_nova_observacao text;
  v_observacao_anterior text;
  v_bitrix_deal_id text;
  v_notas_alteradas jsonb := '[]'::jsonb;
begin
  select * into v_auditoria
  from public.auditorias
  where id = p_auditoria_id
  for update;

  if v_auditoria.id is null or v_auditoria.status <> 'pendente' then
    raise exception 'auditoria_indisponivel' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_leads) <> 'array' or jsonb_array_length(p_leads) = 0 then
    raise exception 'checklist_vazio' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_leads)
  loop
    v_atendidos := coalesce((v_item ->> 'tentativaContato')::boolean, false)
      and coalesce((v_item ->> 'comentarioBitrix')::boolean, false)
      and coalesce((v_item ->> 'etapaAtualizada')::boolean, false);
    v_nova_observacao := nullif(btrim(coalesce(v_item ->> 'observacao', '')), '');

    select o.observacao_lideranca, o.bitrix_deal_id
    into v_observacao_anterior, v_bitrix_deal_id
    from public.oportunidades o
    where o.id = (v_item ->> 'oportunidadeId')::uuid
      and o.corretor_id = v_auditoria.corretor_id
      and o.captada_em is not null
      and o.auditoria_aprovada_em is null;

    if not found then
      continue;
    end if;

    update public.oportunidades
    set tentativa_contato_ok = coalesce((v_item ->> 'tentativaContato')::boolean, false),
        comentario_bitrix_ok = coalesce((v_item ->> 'comentarioBitrix')::boolean, false),
        etapa_atualizada_ok = coalesce((v_item ->> 'etapaAtualizada')::boolean, false),
        auditoria_aprovada_em = case when v_atendidos then now() else null end,
        ultima_auditoria_em = now(),
        auditoria_lider_id = p_lider_id,
        observacao_lideranca = v_nova_observacao,
        observacao_lideranca_em = case
          when v_nova_observacao is distinct from v_observacao_anterior then now()
          else observacao_lideranca_em
        end
    where id = (v_item ->> 'oportunidadeId')::uuid
      and corretor_id = v_auditoria.corretor_id
      and captada_em is not null
      and auditoria_aprovada_em is null;

    if found then
      v_atualizados := v_atualizados + 1;
      if v_atendidos then v_liberados := v_liberados + 1; end if;
      if v_nova_observacao is distinct from v_observacao_anterior then
        v_notas_alteradas := v_notas_alteradas || jsonb_build_array(
          jsonb_build_object(
            'bitrix_deal_id', v_bitrix_deal_id,
            'observacao', coalesce(v_nova_observacao, '')
          )
        );
      end if;
    end if;
  end loop;

  if v_atualizados <> jsonb_array_length(p_leads) then
    raise exception 'lead_auditoria_indisponivel' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_pendentes
  from public.oportunidades
  where corretor_id = v_auditoria.corretor_id
    and captada_em is not null
    and auditoria_aprovada_em is null;

  update public.auditorias
  set status = case when v_pendentes = 0 then 'aprovado'::public.status_auditoria else 'pendente'::public.status_auditoria end,
      criterios_avaliados = p_leads,
      concluida_em = case when v_pendentes = 0 then now() else null end,
      lider_id = p_lider_id
  where id = p_auditoria_id;

  insert into public.logs_auditoria (usuario_id, acao, entidade, entidade_id, payload)
  values (
    p_lider_id,
    'checklist_leads_salvo',
    'auditoria',
    p_auditoria_id,
    jsonb_build_object(
      'corretor_id', v_auditoria.corretor_id,
      'leads_avaliados', v_atualizados,
      'vagas_liberadas', v_liberados,
      'leads_pendentes', v_pendentes,
      'notas_alteradas', v_notas_alteradas
    )
  );

  return jsonb_build_object(
    'auditoria_id', p_auditoria_id,
    'vagas_liberadas', v_liberados,
    'leads_pendentes', v_pendentes,
    'notas_alteradas', v_notas_alteradas
  );
end;
$$;

revoke all on function public.salvar_checklist_auditoria(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.salvar_checklist_auditoria(uuid, uuid, jsonb) to service_role;
