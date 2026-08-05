import "server-only";

import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import {
  fetchCapturedDealSnapshots,
  type CapturedDealSnapshot,
} from "@/lib/bitrix/fetch-captured-deal-snapshots";
import { fetchBitrixUserPhotos } from "@/lib/bitrix/fetch-user-photos";
import { getViewerContext, type ViewerContext } from "@/lib/auth/viewer-context";
import { canViewResultados } from "@/lib/auth/perfil";
import { isContaDemonstracao } from "@/lib/auth/conta-demonstracao";
import type { StatusOportunidade } from "@/lib/database.types";
import { getBitrixCaptureTarget } from "@/lib/bitrix/capture-target";
import { filterCapturasConfirmadasDoSistema, isCapturaDoSistema, partitionRoletas } from "@/lib/data/captura-sistema";
import { bucketForSystemCapture } from "@/lib/data/resultados-captura";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import { isDateInResultadosRange, type ResultadosDateRange } from "@/lib/resultados-filters";
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

function inEquipeScope(viewer: ViewerContext, equipeId: string) {
  if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
  return viewer.equipeId === equipeId;
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
  email: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  perfil: string;
  foto_url: string | null;
  bitrix_user_id: string | null;
};

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
  systemLeads: ResultadoLead[],
  photosByUserId: Map<string, string | null>,
  equipes: Array<{ id: string; nome: string }>,
) {
  const byTeam = new Map<string, { equipeId: string; equipe: string; total: number; andamento: number; perdidos: number; quarentena: number }>();
  const byBroker = new Map<string, ResultadoTopCorretor>();

  function ensureTeam(equipeId: string, equipe: string) {
    const teamEntry = byTeam.get(equipe) ?? { equipeId, equipe, total: 0, andamento: 0, perdidos: 0, quarentena: 0 };
    byTeam.set(equipe, teamEntry);
    return teamEntry;
  }

  for (const equipe of equipes) {
    const nome = equipe.nome.trim();
    if (!nome) continue;
    ensureTeam(equipe.id, nome);
  }

  for (const lead of systemLeads) {
    const teamEntry = ensureTeam(lead.equipe, lead.equipe);
    teamEntry.total += 1;
    if (lead.bucket === "andamento") teamEntry.andamento += 1;
    if (lead.bucket === "perdidos") teamEntry.perdidos += 1;
    if (lead.bucket === "quarentena") teamEntry.quarentena += 1;

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

  const capturasPorEquipe = equipes
    .map((equipe) => {
      const nome = equipe.nome.trim();
      return byTeam.get(nome) ?? {
        equipeId: equipe.id,
        equipe: nome,
        total: 0,
        andamento: 0,
        perdidos: 0,
        quarentena: 0,
      };
    })
    .sort((a, b) => b.total - a.total || a.equipe.localeCompare(b.equipe, "pt-BR"));

  return {
    capturasPorEquipe,
    topCorretores: [...byBroker.values()]
      .sort((a, b) => b.total - a.total || a.corretor.localeCompare(b.corretor, "pt-BR"))
      .slice(0, 5),
  };
}

export async function getResultadosData(range: ResultadosDateRange | null = null): Promise<ResultadosData> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) return emptyData();
  const viewer = await getViewerContext();
  if (!viewer || !canViewResultados(viewer.perfil)) return emptyData();

  const admin = createAdminClient();
  const [usersResult, equipesResult, roletas, brokerRoletaPairs, capturedOpportunities, capturasDiariasResult] = await Promise.all([
    admin.from("usuarios").select("id, nome, email, equipe_id, equipe_nome, perfil, foto_url, bitrix_user_id").eq("ativo", true).eq("perfil", "corretor"),
    admin.from("equipes").select("id, nome").order("nome"),
    listRoletas(admin),
    listBrokerRoletaPairs(admin),
    listCapturedOpportunities(admin),
    admin.from("capturas_diarias").select("corretor_id, data, quantidade_captada"),
  ]);
  if (usersResult.error) throw new Error(usersResult.error.message);
  if (equipesResult.error) throw new Error(equipesResult.error.message);
  if (capturasDiariasResult.error) throw new Error(capturasDiariasResult.error.message);

  const scopedEquipes = (equipesResult.data ?? [])
    .filter((equipe) => inEquipeScope(viewer, equipe.id))
    .map((equipe) => ({ id: equipe.id, nome: equipe.nome.trim() }))
    .filter((equipe) => equipe.nome);

  const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas(roletas);

  const users = new Map(
    (usersResult.data ?? [])
      .filter((user) => !isContaDemonstracao(user))
      .filter((user) => inScope(viewer, user))
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
  const confirmedCapturas = filterCapturasConfirmadasDoSistema(
    scopedCapturas,
    capturaRoletaIds,
    comercialGeralRoletaIds,
    capturasDiariasResult.data ?? [],
  );

  const snapshotDealIds = [...new Set(confirmedCapturas.map((item) => item.bitrix_deal_id))];
  const comercialCategoryId = getBitrixCaptureTarget().categoryId;
  const snapshots = await fetchCapturedDealSnapshots(snapshotDealIds);
  const stageNamesByCategory = await buildStageNameMaps([
    comercialCategoryId,
    ...[...snapshots.values()].map((snapshot) => snapshot.categoryId),
  ]);

  const systemLeads: ResultadoLead[] = confirmedCapturas.map((item) => {
    const snapshot = snapshots.get(item.bitrix_deal_id);
    const stageId = stripStageSemanticSuffix(snapshot?.stageId ?? item.bitrix_stage_id);
    const stage = resolveStageName(stageNamesByCategory, snapshot, item.bitrix_stage_id, "Etapa não identificada");
    const bucket = bucketForSystemCapture(item.status, stage, stageId, snapshot, comercialCategoryId);
    return mapOpportunityToLead(item, users, snapshots, stageNamesByCategory, bucket);
  });

  const leads = systemLeads.filter((lead) => isDateInResultadosRange(lead.captadaEm, range));
  const photosByUserId = await resolveBrokerPhotos(users.values());

  const indicadores = leads.reduce<ResultadosData["indicadores"]>((acc, lead) => {
    acc.total += 1;
    acc[lead.bucket] += 1;
    return acc;
  }, { total: 0, andamento: 0, vendas: 0, perdidos: 0, retornaram: 0, quarentena: 0 });

  const { capturasPorEquipe, topCorretores } = buildCapturaStats(leads, photosByUserId, scopedEquipes);

  return { indicadores, leads, capturasPorEquipe, topCorretores, geradoEm: new Date().toISOString() };
}
