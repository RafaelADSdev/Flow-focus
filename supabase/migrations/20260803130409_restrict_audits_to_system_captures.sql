-- `captada_em` representa exclusivamente uma captura feita pelo Flow Focus.
-- Importações históricas do Bitrix chegaram a preencher esse campo; o livro
-- `capturas_diarias` é a fonte confiável para reconciliar o legado.
with ranked_capture_candidates as (
  select
    o.id,
    o.corretor_id,
    o.captada_em::date as data_captura,
    row_number() over (
      partition by o.corretor_id, o.captada_em::date
      order by o.captada_em, o.id
    ) as posicao
  from public.oportunidades o
  join public.roletas r on r.id = o.roleta_id
  where o.corretor_id is not null
    and o.captada_em is not null
    and r.bitrix_category_id = '36'
    and r.bitrix_funil_id not like '%:dashboard'
),
confirmed_system_captures as (
  select candidate.id
  from ranked_capture_candidates candidate
  join public.capturas_diarias capture_log
    on capture_log.corretor_id = candidate.corretor_id
   and capture_log.data = candidate.data_captura
   and candidate.posicao <= capture_log.quantidade_captada
)
update public.oportunidades opportunity
set captada_em = null,
    tentativa_contato_ok = false,
    comentario_bitrix_ok = false,
    etapa_atualizada_ok = false,
    auditoria_aprovada_em = null,
    ultima_auditoria_em = null,
    auditoria_lider_id = null
where opportunity.captada_em is not null
  and not exists (
    select 1
    from confirmed_system_captures confirmed
    where confirmed.id = opportunity.id
  );

-- Auditorias sem qualquer lead do sistema pendente deixam de ocupar a fila.
-- O histórico é preservado; nenhum registro é apagado.
update public.auditorias audit
set status = 'aprovado'::public.status_auditoria,
    concluida_em = coalesce(audit.concluida_em, now()),
    observacoes = coalesce(
      nullif(audit.observacoes, ''),
      'Encerrada automaticamente: sem leads capturados pelo Flow Focus pendentes.'
    )
where audit.status = 'pendente'
  and not exists (
    select 1
    from public.oportunidades opportunity
    where opportunity.corretor_id = audit.corretor_id
      and opportunity.captada_em is not null
      and opportunity.auditoria_aprovada_em is null
  );
