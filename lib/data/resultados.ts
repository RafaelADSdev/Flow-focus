import "server-only";

import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import {
  fetchCapturedDealSnapshots,
  isQuarantineSnapshot,
  isSignedContractSnapshot,
  type CapturedDealSnapshot,
} from "@/lib/bitrix/fetch-captured-deal-snapshots";
import { fetchQuarantineDeals, type QuarantineDeal } from "@/lib/bitrix/fetch-quarantine-deals";
import { fetchBitrixUserPhotos } from "@/lib/bitrix/fetch-user-photos";
import { getViewerContext, type ViewerContext } from "@/lib/auth/viewer-context";
import { canViewResultados } from "@/lib/auth/perfil";
import type { StatusOportunidade } from "@/lib/database.types";
import { getBitrixCaptureTarget } from "@/lib/bitrix/capture-target";
import { isCapturaDoSistema, partitionRoletas } from "@/lib/data/captura-sistema";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import type { ResultadoBucket, ResultadoLead, ResultadosData, ResultadoTopCorretor } from "@/lib/types/resultados";

type OpportunityRow = {
  id: string;
  bitrix_deal_id: string;
  corretor_id: string | null;
  roleta_id: string;
  titulo: string | null;
  status: StatusOportunidade;
  captada_em: string | null;
  data_criacao_bitrix: string | null;
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

function classifyCapturaSistema(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
  snapshot?: CapturedDealSnapshot,
): Exclude<ResultadoBucket, "total" | "quarentena"> {
  if (snapshot) {
    if (isSignedContractSnapshot(snapshot)) return "vendas";
    if (snapshot.stageSemantic.toUpperCase() === "F") return "perdidos";
  } else if (status === "convertida") {
    return "vendas";
  }

  return classifyLocal(status, stage, stageId);
}

function isQuarentenaComercialGeral(snapshot: CapturedDealSnapshot | undefined, comercialCategoryId: string) {
  return Boolean(
    snapshot
    && snapshot.categoryId === comercialCategoryId
    && isQuarantineSnapshot(snapshot),
  );
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
      .select("id, bitrix_deal_id, corretor_id, roleta_id, titulo, status, captada_em, data_criacao_bitrix, bitrix_stage_id, ultima_atualizacao_bitrix")
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

async function listComercialGeralOpportunities(
  admin: ReturnType<typeof createAdminClient>,
  roletaIds: Set<string>,
) {
  if (!roletaIds.size) return [] as OpportunityRow[];
  const rows: OpportunityRow[] = [];
  const roletaIdList = [...roletaIds];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("oportunidades")
      .select("id, bitrix_deal_id, corretor_id, roleta_id, titulo, status, captada_em, data_criacao_bitrix, bitrix_stage_id, ultima_atualizacao_bitrix")
      .not("corretor_id", "is", null)
      .in("roleta_id", roletaIdList)
      .order("ultima_atualizacao_bitrix", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as OpportunityRow[]));
    if (data.length < 1000) break;
  }
  return rows;
}

function mapOpportunityToLead(
  item: OpportunityRow,
  users: Map<string, UserRow>,
  snapshots: Map<string, CapturedDealSnapshot>,
  stageNamesByCategory: Map<string, Map<string, string>>,
  bucket: Exclude<ResultadoBucket, "total">,
) {
  const corretor = users.get(item.corretor_id!)!;
  const equipe = corretor.equipe_nome?.trim() || "Sem equipe";
  const snapshot = snapshots.get(item.bitrix_deal_id);
  const stageId = stripStageSemanticSuffix(snapshot?.stageId ?? item.bitrix_stage_id);
  const stage = resolveStageName(stageNamesByCategory, snapshot, item.bitrix_stage_id, "Etapa não identificada");
  const captadaEm = item.captada_em ?? item.data_criacao_bitrix ?? item.ultima_atualizacao_bitrix ?? new Date().toISOString();
  return {
    id: item.id,
    bitrixDealId: item.bitrix_deal_id,
    cliente: snapshot?.titulo?.trim() || item.titulo?.trim() || `Negócio #${item.bitrix_deal_id}`,
    corretorId: corretor.id,
    corretor: corretor.nome,
    equipe,
    captadaEm,
    etapaAtual: stage,
    ultimaAtualizacao: snapshot?.dateModify ?? item.ultima_atualizacao_bitrix,
    situacao: situation(bucket),
    bucket,
  } satisfies ResultadoLead;
}

function mapQuarantineDealToLead(
  deal: QuarantineDeal,
  corretor: UserRow,
  opportunity: OpportunityRow | undefined,
  stageNamesByCategory: Map<string, Map<string, string>>,
): ResultadoLead {
  const stageId = stripStageSemanticSuffix(deal.stageId);
  const stage = stageNamesByCategory.get(deal.categoryId)?.get(stageId) ?? "Etapa não identificada";
  const captadaEm = opportunity?.captada_em
    ?? opportunity?.data_criacao_bitrix
    ?? deal.dateCreate
    ?? deal.dateModify
    ?? new Date().toISOString();
  return {
    id: opportunity?.id ?? `quarentena:${deal.bitrixDealId}`,
    bitrixDealId: deal.bitrixDealId,
    cliente: deal.titulo || opportunity?.titulo?.trim() || `Negócio #${deal.bitrixDealId}`,
    corretorId: corretor.id,
    corretor: corretor.nome,
    equipe: corretor.equipe_nome?.trim() || "Sem equipe",
    captadaEm,
    etapaAtual: stage,
    ultimaAtualizacao: deal.dateModify ?? opportunity?.ultima_atualizacao_bitrix ?? null,
    situacao: situation("quarentena"),
    bucket: "quarentena",
  };
}

async function listRoletas(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("roletas")
    .select("id, nome, bitrix_funil_id, bitrix_category_id")
    .eq("ativa", true);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listBrokerRoletaPairs(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.from("roletas_corretor").select("corretor_id, roleta_id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((item) => `${item.corretor_id}:${item.roleta_id}`));
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
  foto_url: string | null;
  bitrix_user_id: string | null;
};

function isOperationalCorretor(user: UserRow) {
  return user.perfil === "corretor" && !/\bteste\b/i.test(user.nome);
}

async function resolveBrokerPhotos(users: Iterable<UserRow>) {
  const photosByUserId = new Map<string, string | null>();
  const missingBitrixIds: string[] = [];

  for (const user of users) {
    const cached = user.foto_url?.trim() || null;
    photosByUserId.set(user.id, cached);
    if (!cached && user.bitrix_user_id?.trim()) {
      missingBitrixIds.push(user.bitrix_user_id.trim());
    }
  }

  const fetched = await fetchBitrixUserPhotos(missingBitrixIds);
  for (const user of users) {
    if (photosByUserId.get(user.id)) continue;
    const bitrixId = user.bitrix_user_id?.trim();
    if (!bitrixId) continue;
    const photo = fetched.get(bitrixId) ?? null;
    if (photo) photosByUserId.set(user.id, photo);
  }

  return photosByUserId;
}

function buildCapturaStats(
  capturaLeads: ResultadoLead[],
  quarentenaLeads: ResultadoLead[],
  photosByUserId: Map<string, string | null>,
) {
  const byTeam = new Map<string, { equipeId: string; equipe: string; total: number; quarentena: number }>();
  const byBroker = new Map<string, ResultadoTopCorretor>();

  function ensureTeam(equipe: string) {
    const teamEntry = byTeam.get(equipe) ?? { equipeId: equipe, equipe, total: 0, quarentena: 0 };
    byTeam.set(equipe, teamEntry);
    return teamEntry;
  }

  for (const lead of capturaLeads) {
    ensureTeam(lead.equipe).total += 1;

    const brokerEntry = byBroker.get(lead.corretorId) ?? {
      corretorId: lead.corretorId,
      corretor: lead.corretor,
      equipe: lead.equipe,
      total: 0,
      fotoUrl: photosByUserId.get(lead.corretorId) ?? null,
    };
    brokerEntry.total += 1;
    byBroker.set(lead.corretorId, brokerEntry);
  }

  for (const lead of quarentenaLeads) {
    ensureTeam(lead.equipe).quarentena += 1;
  }

  return {
    capturasPorEquipe: [...byTeam.values()].sort(
      (a, b) => (b.total + b.quarentena) - (a.total + a.quarentena) || a.equipe.localeCompare(b.equipe, "pt-BR"),
    ),
    topCorretores: [...byBroker.values()]
      .sort((a, b) => b.total - a.total || a.corretor.localeCompare(b.corretor, "pt-BR"))
      .slice(0, 5),
  };
}

export async function getResultadosData(): Promise<ResultadosData> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) return emptyData();
  const viewer = await getViewerContext();
  if (!viewer || !canViewResultados(viewer.perfil)) return emptyData();

  const admin = createAdminClient();
  const [usersResult, roletas, brokerRoletaPairs, capturedOpportunities] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome, perfil, foto_url, bitrix_user_id").eq("ativo", true).eq("perfil", "corretor"),
    listRoletas(admin),
    listBrokerRoletaPairs(admin),
    listCapturedOpportunities(admin),
  ]);
  if (usersResult.error) throw new Error(usersResult.error.message);

  const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas(roletas);
  const comercialOpportunities = await listComercialGeralOpportunities(admin, comercialGeralRoletaIds);

  const users = new Map(
    (usersResult.data ?? [])
      .filter((user) => inScope(viewer, user) && isOperationalCorretor(user))
      .map((user) => [user.id, user]),
  );

  function inBrokerCarteira(item: OpportunityRow) {
    return Boolean(
      item.corretor_id
      && users.has(item.corretor_id)
      && brokerRoletaPairs.has(`${item.corretor_id}:${item.roleta_id}`),
    );
  }

  const scopedCapturas = capturedOpportunities.filter((item) => (
    inBrokerCarteira(item)
    && isCapturaDoSistema(item, capturaRoletaIds, comercialGeralRoletaIds)
  ));

  const scopedComercial = comercialOpportunities.filter(inBrokerCarteira);

  const snapshotDealIds = [
    ...new Set([
      ...scopedCapturas.map((item) => item.bitrix_deal_id),
      ...scopedComercial.map((item) => item.bitrix_deal_id),
    ]),
  ];
  const comercialCategoryId = getBitrixCaptureTarget().categoryId;
  const [snapshots, quarantineDeals] = await Promise.all([
    fetchCapturedDealSnapshots(snapshotDealIds),
    fetchQuarantineDeals(comercialCategoryId).catch(() => [] as QuarantineDeal[]),
  ]);
  const stageNamesByCategory = await buildStageNameMaps([
    comercialCategoryId,
    ...[...snapshots.values()].map((snapshot) => snapshot.categoryId),
    ...quarantineDeals.map((deal) => deal.categoryId),
  ]);

  const capturaLeads: ResultadoLead[] = scopedCapturas.map((item) => {
    const snapshot = snapshots.get(item.bitrix_deal_id);
    const stageId = stripStageSemanticSuffix(snapshot?.stageId ?? item.bitrix_stage_id);
    const stage = resolveStageName(stageNamesByCategory, snapshot, item.bitrix_stage_id, "Etapa não identificada");
    const bucket = classifyCapturaSistema(item.status, stage, stageId, snapshot);
    return mapOpportunityToLead(item, users, snapshots, stageNamesByCategory, bucket);
  });

  const quarentenaSeen = new Set<string>();
  const quarentenaLeads: ResultadoLead[] = [];

  const usersByBitrixId = new Map<string, UserRow>();
  for (const user of users.values()) {
    const bitrixId = user.bitrix_user_id?.trim();
    if (bitrixId) usersByBitrixId.set(bitrixId, user);
  }

  const opportunityByDealId = new Map<string, OpportunityRow>();
  for (const item of [...capturedOpportunities, ...comercialOpportunities]) {
    if (!opportunityByDealId.has(item.bitrix_deal_id)) opportunityByDealId.set(item.bitrix_deal_id, item);
  }

  for (const deal of quarantineDeals) {
    const corretor = usersByBitrixId.get(deal.assignedById);
    if (!corretor || quarentenaSeen.has(deal.bitrixDealId)) continue;
    quarentenaSeen.add(deal.bitrixDealId);
    quarentenaLeads.push(
      mapQuarantineDealToLead(deal, corretor, opportunityByDealId.get(deal.bitrixDealId), stageNamesByCategory),
    );
  }

  for (const item of [...scopedCapturas, ...scopedComercial]) {
    if (quarentenaSeen.has(item.bitrix_deal_id)) continue;
    const snapshot = snapshots.get(item.bitrix_deal_id);
    if (!isQuarentenaComercialGeral(snapshot, comercialCategoryId)) continue;
    quarentenaSeen.add(item.bitrix_deal_id);
    quarentenaLeads.push(mapOpportunityToLead(item, users, snapshots, stageNamesByCategory, "quarentena"));
  }

  const leads = [...capturaLeads, ...quarentenaLeads];
  const photosByUserId = await resolveBrokerPhotos(users.values());

  const indicadores = capturaLeads.reduce<ResultadosData["indicadores"]>((acc, lead) => {
    acc.total += 1;
    acc[lead.bucket] += 1;
    return acc;
  }, { total: 0, andamento: 0, vendas: 0, perdidos: 0, retornaram: 0, quarentena: 0 });
  indicadores.quarentena = quarentenaLeads.length;

  const { capturasPorEquipe, topCorretores } = buildCapturaStats(capturaLeads, quarentenaLeads, photosByUserId);

  return { indicadores, leads, capturasPorEquipe, topCorretores, geradoEm: new Date().toISOString() };
}
