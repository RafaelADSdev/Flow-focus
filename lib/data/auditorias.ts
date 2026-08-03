import "server-only";

import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import { refreshCapturedDealsForCorretores } from "@/lib/bitrix/refresh-captured-deals";
import { canManageOperacao, getViewerContext, type ViewerContext } from "@/lib/auth/viewer-context";
import { isContaDemonstracao } from "@/lib/auth/conta-demonstracao";
import { filterCapturasConfirmadasDoSistema, partitionRoletas } from "@/lib/data/captura-sistema";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import type { AuditoriaFilaItem, AuditoriasPainelData } from "@/lib/types/auditorias";

export type { AuditoriaFilaItem, AuditoriasPainelData } from "@/lib/types/auditorias";

type AuditoriaRow = {
  id: string;
  corretor_id: string;
  status: string;
  data: string;
  concluida_em: string | null;
};

type UsuarioRow = {
  id: string;
  nome: string;
  equipe_id: string | null;
  equipe_nome: string | null;
};

type OportunidadeAuditoriaRow = {
  id: string;
  bitrix_deal_id: string;
  roleta_id: string;
  corretor_id: string;
  titulo: string | null;
  captada_em: string;
  data_criacao_bitrix: string | null;
  bitrix_stage_id: string | null;
  ultima_atualizacao_bitrix: string | null;
  tentativa_contato_ok: boolean;
  comentario_bitrix_ok: boolean;
  etapa_atualizada_ok: boolean;
  auditoria_aprovada_em: string | null;
};

export function getEmptyAuditoriasPainel(): AuditoriasPainelData {
  return {
    aguardando: 0,
    aprovadas_semana: 0,
    bloqueados: 0,
    tempo_medio_horas: 0,
    tempo_medio_variacao_min: 0,
    fila: [],
    gerado_em: new Date().toISOString(),
  };
}

function inViewerScope(viewer: ViewerContext, equipeId: string | null) {
  return viewer.perfil === "admin" || viewer.perfil === "diretora" || equipeId === viewer.equipeId;
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

async function resolveLiderId(
  admin: ReturnType<typeof createAdminClient>,
  equipeId: string | null,
  fallbackUserId: string,
) {
  if (equipeId) {
    const { data: equipe } = await admin.from("equipes").select("lider_id").eq("id", equipeId).maybeSingle();
    if (equipe?.lider_id) return equipe.lider_id;
  }

  const { data: adminUser } = await admin
    .from("usuarios")
    .select("id")
    .eq("perfil", "admin")
    .eq("ativo", true)
    .order("nome")
    .limit(1)
    .maybeSingle();

  return adminUser?.id ?? fallbackUserId;
}

export async function ensurePendingAuditoriaForCorretor(
  admin: ReturnType<typeof createAdminClient>,
  corretorId: string,
) {
  const { data: existing } = await admin
    .from("auditorias")
    .select("id")
    .eq("corretor_id", corretorId)
    .eq("status", "pendente")
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { data: usuario } = await admin
    .from("usuarios")
    .select("equipe_id")
    .eq("id", corretorId)
    .maybeSingle();
  if (!usuario) return;

  const liderId = await resolveLiderId(admin, usuario.equipe_id, corretorId);
  const { error } = await admin.from("auditorias").insert({
    corretor_id: corretorId,
    lider_id: liderId,
    status: "pendente",
    criterios_avaliados: [],
  } as never);

  if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
}

async function ensurePendingAuditorias(
  admin: ReturnType<typeof createAdminClient>,
  capturaRoletaIds: Set<string>,
  comercialGeralRoletaIds: Set<string>,
  capturasDiarias: Array<{ corretor_id: string; data: string; quantidade_captada: number }>,
) {
  const { data, error } = await admin
    .from("oportunidades")
    .select("id, corretor_id, roleta_id, captada_em, data_criacao_bitrix")
    .not("corretor_id", "is", null)
    .not("captada_em", "is", null)
    .is("auditoria_aprovada_em", null);
  if (error) throw new Error(error.message);

  const pendingSystemCaptures = filterCapturasConfirmadasDoSistema(
    data ?? [],
    capturaRoletaIds,
    comercialGeralRoletaIds,
    capturasDiarias,
  );
  const brokerIds = [...new Set(
    pendingSystemCaptures
      .map((item) => item.corretor_id)
      .filter(Boolean),
  )] as string[];

  const { data: brokerProfiles } = brokerIds.length
    ? await admin.from("usuarios").select("id, nome, email").in("id", brokerIds)
    : { data: [] as Array<{ id: string; nome: string; email: string }> };
  const operationalBrokerIds = (brokerProfiles ?? [])
    .filter((broker) => !isContaDemonstracao(broker))
    .map((broker) => broker.id);

  for (const corretorId of operationalBrokerIds) await ensurePendingAuditoriaForCorretor(admin, corretorId);
  return {
    brokerIds: operationalBrokerIds,
    opportunityIds: pendingSystemCaptures
      .filter((item) => item.corretor_id && operationalBrokerIds.includes(item.corretor_id))
      .map((item) => item.id),
  };
}

function averageHours(items: Array<{ captada_em: string; auditoria_aprovada_em: string | null }>) {
  const approved = items.filter((item) => item.auditoria_aprovada_em);
  if (!approved.length) return 0;
  const total = approved.reduce((sum, item) => (
    sum + (Date.parse(item.auditoria_aprovada_em!) - Date.parse(item.captada_em)) / 3_600_000
  ), 0);
  return Math.round((total / approved.length) * 10) / 10;
}

async function loadAuditoriasFromTables(viewer: ViewerContext): Promise<AuditoriasPainelData> {
  const admin = createAdminClient();
  const { data: roletas, error: roletasError } = await admin
    .from("roletas")
    .select("id, nome, bitrix_funil_id, bitrix_category_id");
  if (roletasError) throw new Error(roletasError.message);

  const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas(roletas ?? []);
  const { data: capturasDiarias, error: capturasDiariasError } = await admin
    .from("capturas_diarias")
    .select("corretor_id, data, quantidade_captada");
  if (capturasDiariasError) throw new Error(capturasDiariasError.message);

  const pendingCaptures = await ensurePendingAuditorias(
    admin,
    capturaRoletaIds,
    comercialGeralRoletaIds,
    capturasDiarias ?? [],
  );
  await refreshCapturedDealsForCorretores(pendingCaptures.brokerIds, {
    onlyPendingAudit: true,
    opportunityIds: pendingCaptures.opportunityIds,
  });

  const [usuariosResult, bloqueiosResult, auditoriasResult, oportunidadesResult, stages] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome").eq("ativo", true).eq("perfil", "corretor"),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin.from("auditorias").select("id, corretor_id, status, data, concluida_em"),
    admin
      .from("oportunidades")
      .select("id, bitrix_deal_id, roleta_id, corretor_id, titulo, captada_em, data_criacao_bitrix, bitrix_stage_id, ultima_atualizacao_bitrix, tentativa_contato_ok, comentario_bitrix_ok, etapa_atualizada_ok, auditoria_aprovada_em")
      .not("corretor_id", "is", null)
      .not("captada_em", "is", null),
    fetchBitrixDealStages(process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16").catch(() => []),
  ]);

  if (usuariosResult.error) throw new Error(usuariosResult.error.message);
  if (bloqueiosResult.error) throw new Error(bloqueiosResult.error.message);
  if (auditoriasResult.error) throw new Error(auditoriasResult.error.message);
  if (oportunidadesResult.error) throw new Error(oportunidadesResult.error.message);

  const usuarios = new Map(
    ((usuariosResult.data ?? []) as UsuarioRow[])
      .filter((item) => !isContaDemonstracao(item))
      .filter((item) => inViewerScope(viewer, item.equipe_id))
      .map((item) => [item.id, item]),
  );
  const auditorias = (auditoriasResult.data ?? []) as AuditoriaRow[];
  const oportunidades = filterCapturasConfirmadasDoSistema(
    (oportunidadesResult.data ?? []) as OportunidadeAuditoriaRow[],
    capturaRoletaIds,
    comercialGeralRoletaIds,
    capturasDiarias ?? [],
  );
  const active = oportunidades.filter((item) => !item.auditoria_aprovada_em && usuarios.has(item.corretor_id));
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const pendingAuditByBroker = new Map(
    auditorias
      .filter((item) => item.status === "pendente" && usuarios.has(item.corretor_id))
      .map((item) => [item.corretor_id, item]),
  );
  const activeByBroker = new Map<string, OportunidadeAuditoriaRow[]>();
  for (const lead of active) {
    const bucket = activeByBroker.get(lead.corretor_id) ?? [];
    bucket.push(lead);
    activeByBroker.set(lead.corretor_id, bucket);
  }
  const lastCaptureByBroker = new Map<string, string>();
  for (const lead of oportunidades) {
    if (!lead.captada_em || !usuarios.has(lead.corretor_id)) continue;
    const current = lastCaptureByBroker.get(lead.corretor_id);
    if (!current || lead.captada_em > current) lastCaptureByBroker.set(lead.corretor_id, lead.captada_em);
  }

  const fila: AuditoriaFilaItem[] = [];
  for (const [corretorId, usuario] of usuarios) {
    const sortedLeads = [...(activeByBroker.get(corretorId) ?? [])].sort((a, b) => a.captada_em.localeCompare(b.captada_em));
    const hasPendingLeads = sortedLeads.length > 0;
    if (!hasPendingLeads) continue;

    let auditoria = pendingAuditByBroker.get(corretorId);
    if (hasPendingLeads && !auditoria) {
      await ensurePendingAuditoriaForCorretor(admin, corretorId);
      const { data } = await admin
        .from("auditorias")
        .select("id, corretor_id, status, data, concluida_em")
        .eq("corretor_id", corretorId)
        .eq("status", "pendente")
        .maybeSingle();
      auditoria = (data as AuditoriaRow | null) ?? undefined;
    }
    if (hasPendingLeads && !auditoria) continue;

    const oldest = sortedLeads[0]?.captada_em;
    fila.push({
      id: auditoria?.id ?? corretorId,
      corretor_id: corretorId,
      corretor: usuario.nome,
      equipe: usuario.equipe_nome ?? "Sem equipe",
      capturados: sortedLeads.length,
      atualizados: sortedLeads.filter((lead) => lead.ultima_atualizacao_bitrix && lead.ultima_atualizacao_bitrix > lead.captada_em).length,
      sem_contato: sortedLeads.filter((lead) => !lead.tentativa_contato_ok).length,
      ultima_captura: lastCaptureByBroker.get(corretorId) ?? null,
      espera_minutos: oldest ? Math.max(Math.floor((Date.now() - Date.parse(oldest)) / 60_000), 0) : 0,
      leads: sortedLeads.map((lead) => ({
        id: lead.id,
        bitrix_deal_id: lead.bitrix_deal_id,
        titulo: lead.titulo?.trim() || `Negócio #${lead.bitrix_deal_id}`,
        captada_em: lead.captada_em,
        etapa_atual: stageNames.get(stripStageSemanticSuffix(lead.bitrix_stage_id)) ?? "Etapa não identificada",
        ultima_atualizacao: lead.ultima_atualizacao_bitrix,
        tentativa_contato_ok: lead.tentativa_contato_ok,
        comentario_bitrix_ok: lead.comentario_bitrix_ok,
        etapa_atualizada_ok: lead.etapa_atualizada_ok,
      })),
    });
  }

  const inicioSemana = startOfWeek();
  const inicioSemanaAnterior = new Date(inicioSemana);
  inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);
  const aprovadosSemana = oportunidades.filter((item) => (
    item.auditoria_aprovada_em
    && Date.parse(item.auditoria_aprovada_em) >= inicioSemana.getTime()
    && usuarios.has(item.corretor_id)
  ));
  const aprovadosSemanaAnterior = oportunidades.filter((item) => (
    item.auditoria_aprovada_em
    && Date.parse(item.auditoria_aprovada_em) >= inicioSemanaAnterior.getTime()
    && Date.parse(item.auditoria_aprovada_em) < inicioSemana.getTime()
    && usuarios.has(item.corretor_id)
  ));
  const tempoAtual = averageHours(aprovadosSemana);
  const tempoAnterior = averageHours(aprovadosSemanaAnterior);
  const bloqueados = new Set(
    (bloqueiosResult.data ?? []).map((item) => item.corretor_id).filter((id) => usuarios.has(id)),
  );

  return {
    aguardando: active.length,
    aprovadas_semana: aprovadosSemana.length,
    bloqueados: bloqueados.size,
    tempo_medio_horas: tempoAtual,
    tempo_medio_variacao_min: Math.round((tempoAnterior - tempoAtual) * 60),
    fila: fila.sort((a, b) => {
      if (a.capturados > 0 && b.capturados === 0) return -1;
      if (a.capturados === 0 && b.capturados > 0) return 1;
      if (a.capturados > 0 && b.capturados > 0) return b.espera_minutos - a.espera_minutos;
      return a.corretor.localeCompare(b.corretor, "pt-BR");
    }),
    gerado_em: new Date().toISOString(),
  };
}

export async function getAuditoriasPainelData(): Promise<AuditoriasPainelData> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) return getEmptyAuditoriasPainel();
  const viewer = await getViewerContext();
  if (!viewer || !canManageOperacao(viewer.perfil)) return getEmptyAuditoriasPainel();

  try {
    return await loadAuditoriasFromTables(viewer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(`Não foi possível carregar as auditorias: ${message}`);
  }
}
