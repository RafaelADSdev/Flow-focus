import "server-only";

import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import { bitrixDealDetailsUrl } from "@/lib/bitrix/portal";
import {
  endOfDayIso,
  labelEsteira,
  startOfDayIso,
  type DashboardFilterOptions,
  type DashboardFilters,
} from "@/lib/dashboard-filters";
import type { ComercialKanbanCard, ComercialKanbanData } from "@/lib/types/comercial-kanban";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";

type OpportunityRow = {
  id: string;
  bitrix_deal_id: string;
  titulo: string | null;
  valor: number | null;
  corretor_id: string | null;
  roleta_id: string;
  roleta_atual: string | null;
  bitrix_stage_id: string | null;
  captada_em: string | null;
  data_criacao_bitrix: string | null;
  ultima_atualizacao_bitrix: string | null;
  criado_em: string;
};

const emptyOptions: DashboardFilterOptions = {
  esteiras: [],
  diretorias: [],
  equipes: [],
  corretores: [],
  roletas: [],
};

function emptyData(filters: DashboardFilters): ComercialKanbanData {
  return { filters, filterOptions: emptyOptions, stages: [], total: 0, canMove: false, brokers: [], generatedAt: new Date().toISOString() };
}

async function fetchAllOpportunities(admin: ReturnType<typeof createAdminClient>) {
  const rows: OpportunityRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("oportunidades")
      .select("id, bitrix_deal_id, titulo, valor, corretor_id, roleta_id, roleta_atual, bitrix_stage_id, captada_em, data_criacao_bitrix, ultima_atualizacao_bitrix, criado_em")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function entryDate(item: OpportunityRow) {
  return item.captada_em ?? item.data_criacao_bitrix ?? item.criado_em;
}

function rouletteLabel(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export async function getComercialKanbanData(filters: DashboardFilters): Promise<ComercialKanbanData> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) return emptyData(filters);

  const viewer = await getViewerContext();
  if (!viewer || !canManageOperacao(viewer.perfil)) return emptyData(filters);

  const admin = createAdminClient();
  const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
  const directorateLabel = process.env.BITRIX24_DIRECTORATE_NAME ?? "Focus";
  const [usersResult, teamsResult, roulettesResult, opportunities, bitrixStages] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome, perfil, ativo").eq("ativo", true),
    admin.from("equipes").select("id, nome, bitrix_diretoria_id").order("nome"),
    admin.from("roletas").select("id, bitrix_category_id").eq("ativa", true),
    fetchAllOpportunities(admin),
    fetchBitrixDealStages(categoryId).catch(() => []),
  ]);

  const teams = (teamsResult.data ?? []).filter((team) => (
    viewer.perfil === "admin"
    || viewer.perfil === "diretora"
    || team.id === viewer.equipeId
  ));
  const teamIds = new Set(teams.map((team) => team.id));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const users = (usersResult.data ?? [])
    .filter((user) => user.perfil === "corretor" && Boolean(user.equipe_id && teamIds.has(user.equipe_id)));
  const userById = new Map(users.map((user) => [user.id, user]));
  const userIds = new Set(users.map((user) => user.id));
  const commercialRouletteIds = new Set(
    (roulettesResult.data ?? [])
      .filter((roulette) => String(roulette.bitrix_category_id ?? "") === categoryId)
      .map((roulette) => roulette.id),
  );

  const directorateIds = [...new Set(
    teams.map((team) => String(team.bitrix_diretoria_id ?? "").trim()).filter(Boolean),
  )];
  const rouletteValues = [...new Set(
    opportunities.map((item) => rouletteLabel(item.roleta_atual)).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filterOptions: DashboardFilterOptions = {
    esteiras: [{ id: categoryId, label: labelEsteira(categoryId) }],
    diretorias: directorateIds.map((id) => ({ id, label: `Diretoria ${directorateLabel}` })),
    equipes: teams.map((team) => ({ id: team.id, nome: team.nome, diretoriaId: team.bitrix_diretoria_id })),
    corretores: users
      .map((user) => ({ id: user.id, nome: user.nome, equipeId: user.equipe_id }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    roletas: rouletteValues.map((value) => ({ value, label: value })),
  };

  const start = startOfDayIso(filters.de);
  const end = endOfDayIso(filters.ate);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  const filtered = opportunities.filter((item) => {
    const isCommercial = commercialRouletteIds.has(item.roleta_id)
      || String(item.bitrix_stage_id ?? "").startsWith(`C${categoryId}:`);
    if (!isCommercial) return false;
    if (!item.corretor_id || !userIds.has(item.corretor_id)) return false;

    const user = userById.get(item.corretor_id);
    const team = user?.equipe_id ? teamById.get(user.equipe_id) : null;
    const date = Date.parse(entryDate(item));
    if (Number.isNaN(date) || date < startTime || date > endTime) return false;
    if (filters.corretor && item.corretor_id !== filters.corretor) return false;
    if (filters.equipe && user?.equipe_id !== filters.equipe) return false;
    if (filters.diretoria && String(team?.bitrix_diretoria_id ?? "") !== filters.diretoria) return false;
    if (filters.roleta && rouletteLabel(item.roleta_atual) !== filters.roleta) return false;
    return true;
  });

  const cardsByStage = new Map<string, ComercialKanbanCard[]>();
  for (const stage of bitrixStages) cardsByStage.set(stage.id, []);

  for (const item of filtered) {
    const stageId = stripStageSemanticSuffix(item.bitrix_stage_id);
    if (!stageId) continue;
    const user = item.corretor_id ? userById.get(item.corretor_id) : null;
    const cards = cardsByStage.get(stageId) ?? [];
    cards.push({
      id: item.id,
      bitrixDealId: item.bitrix_deal_id,
      title: item.titulo?.trim() || `Negócio #${item.bitrix_deal_id}`,
      value: Number(item.valor ?? 0),
      assignedTo: user?.nome ?? "Sem corretor",
      team: user?.equipe_nome?.trim() || "Sem equipe",
      roulette: rouletteLabel(item.roleta_atual) || "Sem roleta",
      enteredAt: entryDate(item),
      updatedAt: item.ultima_atualizacao_bitrix ?? entryDate(item),
      stageId,
      bitrixUrl: bitrixDealDetailsUrl(item.bitrix_deal_id),
    });
    cardsByStage.set(stageId, cards);
  }

  const stageMeta = new Map(bitrixStages.map((stage) => [stage.id, stage]));
  const orderedIds = [
    ...bitrixStages.map((stage) => stage.id),
    ...[...cardsByStage.keys()].filter((id) => !stageMeta.has(id)).sort(),
  ];
  const stages = orderedIds.map((id) => {
    const meta = stageMeta.get(id);
    return {
      id,
      name: meta?.name ?? id.replace(/^C\d+:/, ""),
      semantics: meta?.semantics ?? null,
      cards: (cardsByStage.get(id) ?? []).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    };
  });

  const brokers = users
    .map((user) => ({ id: user.id, name: user.nome, team: user.equipe_nome?.trim() || "Sem equipe" }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { filters, filterOptions, stages, total: filtered.length, canMove: bitrixStages.length > 0, brokers, generatedAt: new Date().toISOString() };
}
