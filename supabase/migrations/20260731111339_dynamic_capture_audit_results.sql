-- Capacidade de captacao passa a ser baseada em leads ainda nao aprovados,
-- independentemente da data da captura.
alter table public.oportunidades
  add column if not exists tentativa_contato_ok boolean not null default false,
  add column if not exists comentario_bitrix_ok boolean not null default false,
  add column if not exists etapa_atualizada_ok boolean not null default false,
  add column if not exists auditoria_aprovada_em timestamptz,
  add column if not exists ultima_auditoria_em timestamptz,
  add column if not exists auditoria_lider_id uuid references public.usuarios(id) on delete set null;

-- Mantem o historico anterior coerente: uma auditoria de carteira aprovada
-- libera os leads capturados antes da sua conclusao.
with historico as (
  select distinct on (o.id)
    o.id as oportunidade_id,
    a.concluida_em,
    a.lider_id
  from public.oportunidades o
  join public.auditorias a
    on a.corretor_id = o.corretor_id
   and a.status = 'aprovado'
   and a.concluida_em is not null
   and o.captada_em is not null
   and a.concluida_em >= o.captada_em
  where o.auditoria_aprovada_em is null
  order by o.id, a.concluida_em
)
update public.oportunidades o
set tentativa_contato_ok = true,
    comentario_bitrix_ok = true,
    etapa_atualizada_ok = true,
    auditoria_aprovada_em = historico.concluida_em,
    ultima_auditoria_em = historico.concluida_em,
    auditoria_lider_id = historico.lider_id
from historico
where o.id = historico.oportunidade_id;

-- Bases antigas podiam acumular um novo lote a cada dia. Na transicao, os seis
-- leads mais recentes permanecem ativos e o excedente legado sai da capacidade.
with ranqueados as (
  select
    id,
    row_number() over (partition by corretor_id order by captada_em desc, id) as posicao
  from public.oportunidades
  where corretor_id is not null
    and captada_em is not null
    and auditoria_aprovada_em is null
)
update public.oportunidades o
set tentativa_contato_ok = true,
    comentario_bitrix_ok = true,
    etapa_atualizada_ok = true,
    auditoria_aprovada_em = now(),
    ultima_auditoria_em = now()
from ranqueados r
where o.id = r.id and r.posicao > 6;

alter table public.capturas_diarias
  drop constraint if exists captura_dentro_do_limite;

alter table public.oportunidades
  drop constraint if exists oportunidade_aprovacao_exige_checklist,
  add constraint oportunidade_aprovacao_exige_checklist check (
    auditoria_aprovada_em is null
    or (tentativa_contato_ok and comentario_bitrix_ok and etapa_atualizada_ok)
  );

create index if not exists oportunidades_capacidade_ativa_idx
  on public.oportunidades (corretor_id, captada_em desc)
  where corretor_id is not null
    and captada_em is not null
    and auditoria_aprovada_em is null;

create or replace function private.validar_limite_leads_ativos()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ativos integer;
begin
  if new.corretor_id is null
    or new.captada_em is null
    or new.auditoria_aprovada_em is not null
    or (tg_op = 'UPDATE'
      and old.corretor_id is not distinct from new.corretor_id
      and old.captada_em is not null
      and old.auditoria_aprovada_em is null)
  then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.corretor_id::text, 0));

  select count(*)::integer
  into v_ativos
  from public.oportunidades o
  where o.corretor_id = new.corretor_id
    and o.captada_em is not null
    and o.auditoria_aprovada_em is null
    and o.id is distinct from new.id;

  if v_ativos >= 6 then
    raise exception 'limite_leads_ativos_atingido' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.validar_limite_leads_ativos() from public, anon, authenticated;

drop trigger if exists oportunidades_limite_leads_ativos on public.oportunidades;
create trigger oportunidades_limite_leads_ativos
before insert or update of corretor_id, captada_em, auditoria_aprovada_em
on public.oportunidades
for each row execute function private.validar_limite_leads_ativos();

-- O historico diario continua crescendo; a auditoria nao zera produtividade.
-- A interface e as operacoes usam esta funcao para a capacidade corrente.
create or replace function public.obter_capacidade_corretor(p_corretor_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ativos', count(*)::integer,
    'limite', 6,
    'disponiveis', greatest(6 - count(*)::integer, 0)
  )
  from public.oportunidades o
  where o.corretor_id = p_corretor_id
    and o.captada_em is not null
    and o.auditoria_aprovada_em is null;
$$;

revoke all on function public.obter_capacidade_corretor(uuid) from public, anon;
grant execute on function public.obter_capacidade_corretor(uuid) to authenticated, service_role;

create or replace function public.salvar_checklist_auditoria(
  p_auditoria_id uuid,
  p_lider_id uuid,
  p_leads jsonb,
  p_observacoes text default null
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

    update public.oportunidades
    set tentativa_contato_ok = coalesce((v_item ->> 'tentativaContato')::boolean, false),
        comentario_bitrix_ok = coalesce((v_item ->> 'comentarioBitrix')::boolean, false),
        etapa_atualizada_ok = coalesce((v_item ->> 'etapaAtualizada')::boolean, false),
        auditoria_aprovada_em = case when v_atendidos then now() else null end,
        ultima_auditoria_em = now(),
        auditoria_lider_id = p_lider_id
    where id = (v_item ->> 'oportunidadeId')::uuid
      and corretor_id = v_auditoria.corretor_id
      and captada_em is not null
      and auditoria_aprovada_em is null;

    if found then
      v_atualizados := v_atualizados + 1;
      if v_atendidos then v_liberados := v_liberados + 1; end if;
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
      observacoes = nullif(p_observacoes, ''),
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
      'leads_pendentes', v_pendentes
    )
  );

  return jsonb_build_object(
    'auditoria_id', p_auditoria_id,
    'vagas_liberadas', v_liberados,
    'leads_pendentes', v_pendentes
  );
end;
$$;

revoke all on function public.salvar_checklist_auditoria(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.salvar_checklist_auditoria(uuid, uuid, jsonb, text) to service_role;

-- Resultados e auditorias recebem mudancas do CRM em tempo real.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'oportunidades'
  ) then
    alter publication supabase_realtime add table public.oportunidades;
  end if;
end;
$$;

-- A nova aba e operacional para todos os perfis ativos.
update public.usuarios
set paginas_acesso = array_append(coalesce(paginas_acesso, '{}'::text[]), '/resultados')
where ativo
  and not ('/resultados' = any(coalesce(paginas_acesso, '{}'::text[])));
