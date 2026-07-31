import "server-only";

import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import {
  fetchCapturedDealSnapshots,
  isQuarantineSnapshot,
  isSignedContractSnapshot,
  type CapturedDealSnapshot,
} from "@/lib/bitrix/fetch-captured-deal-snapshots";
import { getViewerContext, type ViewerContext } from "@/lib/auth/viewer-context";
import type { StatusOportunidade } from "@/lib/database.types";
import { isRoletaCaptura } from "@/lib/data/roleta-captura";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import type { ResultadoBucket, ResultadoLead, ResultadosData } from "@/lib/types/resultados";

type OpportunityRow = {
  id: string;
  bitrix_deal_id: string;
  corretor_id: string | null;
  roleta_id: string;
  titulo: string | null;
  status: StatusOportunidade;
  captada_em: string | null;
  bitrix_stage_id: string | null;
  ultima_atualizacao_bitrix: string | null;
};

function emptyData(): ResultadosData {
  return {
    indicadores: { total: 0, andamento: 0, vendas: 0, perdidos: 0, retornaram: 0, quarentena: 0 },
    leads: [],
    capturasPorEquipe: [],
    topCorretores: [],
    geradoEm: new Date().toISOString(),
  };
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function configuredIds(value: string | undefined) {
  return new Set(String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

function classifyLocal(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
): Exclude<ResultadoBucket, "total" | "vendas" | "quarentena"> {
  const normalized = normalize(`${stage} ${stageId}`);
  const returnIds = configuredIds(
    process.env.BITRIX24_RETURN_TO_POOL_STAGE_IDS
      ?? process.env.BITRIX24_FILTER_STAGE_ID
      ?? "C36:NEW",
  );
  if (returnIds.has(stageId) || normalized.includes("bolsao") || normalized.includes("retorn")) return "retornaram";
  if (status === "perdida") return "perdidos";
  return "andamento";
}

function classifyLead(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
  snapshot?: CapturedDealSnapshot,
): Exclude<ResultadoBucket, "total"> {
  if (snapshot) {
    if (isQuarantineSnapshot(snapshot)) return "quarentena";
    if (isSignedContractSnapshot(snapshot)) return "vendas";
    if (snapshot.stageSemantic.toUpperCase() === "F") return "perdidos";
  } else if (status === "convertida") {
    return "vendas";
  }

  return classifyLocal(status, stage, stageId);
}

function situation(bucket: Exclude<ResultadoBucket, "total">) {
  return {
    andamento: "Em andamento",
    vendas: "Contrato assinado",
    perdidos: "Negócio perdido",
    retornaram: "Retornou para o bolsão",
    quarentena: "Em quarentena",
  }[bucket];
}

function inScope(viewer: ViewerContext, user: { id: string; equipe_id: string | null }) {
  if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
  if (viewer.perfil === "corretor") return user.id === viewer.userId;
  return user.equipe_id === viewer.equipeId;
}

async function listCapturedOpportunities(admin: ReturnType<typeof createAdminClient>) {
  const rows: OpportunityRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("oportunidades")
      .select("id, bitrix_deal_id, corretor_id, roleta_id, titulo, status, captada_em, bitrix_stage_id, ultima_atualizacao_bitrix")
      .not("corretor_id", "is", null)
      .not("captada_em", "is", null)
      .order("captada_em", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as OpportunityRow[]));
    if (data.length < 1000) break;
  }
  return rows;
}

async function listCapturaRoletaIds(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("roletas")
    .select("id, nome, bitrix_funil_id, bitrix_category_id")
    .eq("ativa", true);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).filter(isRoletaCaptura).map((roleta) => roleta.id));
}

async function buildStageNameMaps(categoryIds: string[]) {
  const maps = new Map<string, Map<string, string>>();
  const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
  await Promise.all(uniqueIds.map(async (categoryId) => {
    const stages = await fetchBitrixDealStages(categoryId).catch(() => []);
    maps.set(categoryId, new Map(stages.map((stage) => [stage.id, stage.name])));
  }));
  return maps;
}

function resolveStageName(
  stageNamesByCategory: Map<string, Map<string, string>>,
  snapshot: CapturedDealSnapshot | undefined,
  fallbackStageId: string | null,
  fallbackLabel: string,
) {
  const stageId = stripStageSemanticSuffix(snapshot?.stageId ?? fallbackStageId);
  const categoryId = snapshot?.categoryId;
  const fromBitrix = categoryId ? stageNamesByCategory.get(categoryId)?.get(stageId) : undefined;
  if (fromBitrix) return fromBitrix;
  if (stageId === (process.env.BITRIX24_FILTER_STAGE_ID ?? "C36:NEW")) return "Bolsão";
  return fallbackLabel;
}

type UserRow = {
  id: string;
  nome: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  perfil: string;
};

function isOperationalCorretor(user: UserRow) {
  return user.perfil === "corretor" && !/\bteste\b/i.test(user.nome);
}

function buildCapturaStats(leads: ResultadoLead[]) {
  const byTeam = new Map<string, { equipeId: string; equipe: string; total: number }>();
  const byBroker = new Map<string, { corretorId: string; corretor: string; equipe: string; total: number }>();

  for (const lead of leads) {
    const teamKey = lead.equipe;
    const teamEntry = byTeam.get(teamKey) ?? { equipeId: teamKey, equipe: lead.equipe, total: 0 };
    teamEntry.total += 1;
    byTeam.set(teamKey, teamEntry);

    const brokerEntry = byBroker.get(lead.corretorId) ?? {
      corretorId: lead.corretorId,
      corretor: lead.corretor,
      equipe: lead.equipe,
      total: 0,
    };
    brokerEntry.total += 1;
    byBroker.set(lead.corretorId, brokerEntry);
  }

  return {
    capturasPorEquipe: [...byTeam.values()].sort(
      (a, b) => b.total - a.total || a.equipe.localeCompare(b.equipe, "pt-BR"),
    ),
    topCorretores: [...byBroker.values()]
      .sort((a, b) => b.total - a.total || a.corretor.localeCompare(b.corretor, "pt-BR"))
      .slice(0, 5),
  };
}

export async function getResultadosData(): Promise<ResultadosData> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) return emptyData();
  const viewer = await getViewerContext();
  if (!viewer) return emptyData();

  const admin = createAdminClient();
  const [usersResult, capturaRoletaIds, opportunities] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome, perfil").eq("ativo", true).eq("perfil", "corretor"),
    listCapturaRoletaIds(admin),
    listCapturedOpportunities(admin),
  ]);
  if (usersResult.error) throw new Error(usersResult.error.message);

  const users = new Map(
    (usersResult.data ?? [])
      .filter((user) => inScope(viewer, user) && isOperationalCorretor(user))
      .map((user) => [user.id, user]),
  );

  const scopedOpportunities = opportunities.filter(
    (item) => item.corretor_id && users.has(item.corretor_id) && capturaRoletaIds.has(item.roleta_id),
  );

  const snapshots = await fetchCapturedDealSnapshots(scopedOpportunities.map((item) => item.bitrix_deal_id));
  const stageNamesByCategory = await buildStageNameMaps(
    [...snapshots.values()].map((snapshot) => snapshot.categoryId),
  );

  const leads: ResultadoLead[] = scopedOpportunities.map((item) => {
    const corretor = users.get(item.corretor_id!)!;
    const equipe = corretor.equipe_nome?.trim() || "Sem equipe";
    const snapshot = snapshots.get(item.bitrix_deal_id);
    const stageId = stripStageSemanticSuffix(snapshot?.stageId ?? item.bitrix_stage_id);
    const stage = resolveStageName(stageNamesByCategory, snapshot, item.bitrix_stage_id, "Etapa não identificada");
    const bucket = classifyLead(item.status, stage, stageId, snapshot);
    return {
      id: item.id,
      bitrixDealId: item.bitrix_deal_id,
      cliente: snapshot?.titulo?.trim() || item.titulo?.trim() || `Negócio #${item.bitrix_deal_id}`,
      corretorId: corretor.id,
      corretor: corretor.nome,
      equipe,
      captadaEm: item.captada_em!,
      etapaAtual: stage,
      ultimaAtualizacao: snapshot?.dateModify ?? item.ultima_atualizacao_bitrix,
      situacao: situation(bucket),
      bucket,
    };
  });

  const indicadores = leads.reduce<ResultadosData["indicadores"]>((acc, lead) => {
    acc.total += 1;
    acc[lead.bucket] += 1;
    return acc;
  }, { total: 0, andamento: 0, vendas: 0, perdidos: 0, retornaram: 0, quarentena: 0 });

  const { capturasPorEquipe, topCorretores } = buildCapturaStats(leads);

  return { indicadores, leads, capturasPorEquipe, topCorretores, geradoEm: new Date().toISOString() };
}
