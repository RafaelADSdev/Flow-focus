-- Legacy projects may retain explicit anon grants even after PUBLIC is revoked.
-- These SECURITY DEFINER functions are only called by verified server actions.
revoke execute on function public.captar_oportunidade(uuid)
  from public, anon, authenticated;
revoke execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.obter_carteira()
  from public, anon, authenticated;
revoke execute on function public.obter_config_roletas()
  from public, anon, authenticated;
revoke execute on function public.obter_painel_auditorias()
  from public, anon, authenticated;

grant execute on function public.captar_oportunidade(uuid) to service_role;
grant execute on function public.concluir_auditoria(uuid, public.status_auditoria, text, jsonb)
  to service_role;
grant execute on function public.obter_carteira() to service_role;
grant execute on function public.obter_config_roletas() to service_role;
grant execute on function public.obter_painel_auditorias() to service_role;
