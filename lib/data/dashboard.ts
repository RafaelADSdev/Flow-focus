import "server-only";

import { z } from "zod";
import type { PerfilUsuario } from "@/lib/database.types";
import { canManageOperacao, getViewerContext, mapPerfil, type ViewerContext } from "@/lib/auth/viewer-context";
import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import {
  dashboardPeriodDays,
  defaultDashboardFilters,
  endOfDayIso,
  labelEsteira,
  startOfDayIso,
  type DashboardFilterOptions,
  type DashboardFilters,
} from "@/lib/dashboard-filters";
import { mapOportunidadeStatus } from "@/lib/data/oportunidade-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";

const STATUS_ATIVOS = ["disponivel", "captada", "em_trabalho", "convertida"] as const;

const dashboardSchema = z.object({
  recebidos: z.number().int().nonnegative(),
  perdidos: z.number().int().nonnegative(),
  ativos: z.number().int().nonnegative(),
  percentual_perdidos: z.number().nonnegative(),
  corretores_ativos_roleta: z.number().int().nonnegative(),
  leads_criticos: z.number().int().nonnegative(),
  periodo_dias: z.number().int().positive(),
  gerado_em: z.string(),
  serie: z.array(z.object({
    data: z.string(),
    recebidos: z.number().int().nonnegative(),
    perdidos: z.number().int().nonnegative(),
  })),
  por_equipe: z.array(z.object({
    nome: z.string(),
    total: z.number().int().nonnegative(),
  })),
  funil: z.array(z.object({
    status: z.string(),
    label: z.string(),
    total: z.number().int().nonnegative(),
    gargalo: z.boolean(),
  })),
  gargalo_label: z.string().nullable(),
  gargalo_total: z.number().int().nonnegative(),
  gargalo_percentual: z.number().nonnegative(),
  por_roleta: z.array(z.object({
    nome: z.string(),
    ativos: z.number().int().nonnegative(),
    perdidos: z.number().int().nonnegative(),
  })),
  corretores: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    equipe: z.string(),
    foto_url: z.string().nullable(),
    status: z.enum(["liberado", "auditoria", "bloqueado"]),
    total: z.number().int().nonnegative(),
    ativos: z.number().int().nonnegative(),
    perdidos: z.number().int().nonnegative(),
    criticos: z.number().int().nonnegative(),
    roletas: z.array(z.string()),
    ultima_atividade: z.string().nullable(),
  })),
});

export type DashboardData = z.infer<typeof dashboardSchema>;

const emptyFilterOptions: DashboardFilterOptions = {
  esteiras: [],
  diretorias: [],
  equipes: [],
  corretores: [],
  roletas: [],
};

function emptyDashboard(filters: DashboardFilters): DashboardData {
  return dashboardSchema.parse({
    recebidos: 0,
    perdidos: 0,
    ativos: 0,
    percentual_perdidos: 0,
    corretores_ativos_roleta: 0,
    leads_criticos: 0,
    periodo_dias: dashboardPeriodDays(filters),
    gerado_em: new Date().toISOString(),
    serie: [],
    por_equipe: [],
    funil: [],
    gargalo_label: null,
    gargalo_total: 0,
    gargalo_percentual: 0,
    por_roleta: [],
    corretores: [],
  });
}

function inViewerScope(viewer: ViewerContext, equipeId: string | null) {
  if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
  return equipeId === viewer.equipeId;
}

function entryDate(item: {
  captada_em: string | null;
  data_criacao_bitrix?: string | null;
  criado_em: string;
}) {
  return item.captada_em ?? item.data_criacao_bitrix ?? item.criado_em;
}

async function loadPerfilByUserId(admin: ReturnType<typeof createAdminClient>) {
  const perfilByUserId = new Map<string, PerfilUsuario>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      perfilByUserId.set(user.id, mapPerfil(String(user.app_metadata?.perfil ?? "corretor")));
    }
    if (data.users.length < 1000) break;
  }
  return perfilByUserId;
}

function roletaAtualLabel(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function buildRoletaAtualOptions(
  oportunidades: Array<{ roleta_atual: string | null }>,
) {
  const values = new Set<string>();
  for (const item of oportunidades) {
    const label = roletaAtualLabel(item.roleta_atual);
    if (label) values.add(label);
  }

  return [...values]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => ({ value, label: value }));
}

function matchesEsteira(
  item: { roleta_id: string; bitrix_stage_id: string | null },
  categoryId: string,
  roletaById: Map<string, { bitrix_category_id: string | null; bitrix_funil_id: string }>,
) {
  const roleta = roletaById.get(item.roleta_id);
  if (roleta && String(roleta.bitrix_category_id ?? "") === String(categoryId)) return true;
  return String(item.bitrix_stage_id ?? "").startsWith(`C${categoryId}:`);
}

async function fetchAllOportunidades(admin: ReturnType<typeof createAdminClient>) {
  const select = "id, captada_em, criado_em, data_criacao_bitrix, corretor_id, roleta_id, roleta_atual, bitrix_stage_id, bitrix_assigned_by_id, ultima_atualizacao_bitrix";
  const rows: Array<{
    id: string;
    captada_em: string | null;
    criado_em: string;
    data_criacao_bitrix: string | null;
    corretor_id: string | null;
    roleta_id: string;
    roleta_atual: string | null;
    bitrix_stage_id: string | null;
    bitrix_assigned_by_id: string | null;
    ultima_atualizacao_bitrix: string | null;
  }> = [];
  const seen = new Set<string>();

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("oportunidades")
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    if (data.length < 1000) break;
  }

  return rows;
}

async function loadDashboardUsuarios(admin: ReturnType<typeof createAdminClient>) {
  const withPhoto = await admin
    .from("usuarios")
    .select("id, nome, equipe_id, equipe_nome, bitrix_user_id, foto_url, ativo, perfil")
    .eq("ativo", true);
  if (!withPhoto.error) return withPhoto;
  if (!withPhoto.error.message.includes("foto_url")) throw withPhoto.error;

  const fallback = await admin
    .from("usuarios")
    .select("id, nome, equipe_id, equipe_nome, bitrix_user_id, ativo, perfil")
    .eq("ativo", true);
  if (fallback.error) throw fallback.error;
  return {
    data: (fallback.data ?? []).map((usuario) => ({ ...usuario, foto_url: null as string | null })),
    error: null,
  };
}

async function loadSharedDashboardContext(viewer: ViewerContext) {
  const admin = createAdminClient();
  const comercialGeralCategoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
  const diretoriaLabel = process.env.BITRIX24_DIRECTORATE_NAME ?? "Focus";

  const [
    usuariosResult,
    oportunidadesRows,
    roletasResult,
    roletasCorretorResult,
    equipesResult,
    perfilByUserId,
    bloqueiosResult,
    auditoriasResult,
  ] = await Promise.all([
    loadDashboardUsuarios(admin),
    fetchAllOportunidades(admin),
    admin.from("roletas").select("id, nome, bitrix_category_id, bitrix_funil_id, bitrix_roleta_valor, ativa").eq("ativa", true),
    admin.from("roletas_corretor").select("corretor_id, roleta_id"),
    admin.from("equipes").select("id, nome, bitrix_diretoria_id").order("nome"),
    loadPerfilByUserId(admin),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin.from("auditorias").select("corretor_id").eq("status", "pendente"),
  ]);

  const equipes = (equipesResult.data ?? []).filter((equipe) => inViewerScope(viewer, equipe.id));
  const equipeById = new Map(equipes.map((equipe) => [equipe.id, equipe]));
  const equipeIdsForDiretoria = (diretoriaId: string) =>
    new Set(equipes.filter((equipe) => String(equipe.bitrix_diretoria_id ?? "") === diretoriaId).map((equipe) => equipe.id));

  const usuarios = (usuariosResult.data ?? [])
    .map((usuario) => ({
      ...usuario,
      perfil: usuario.perfil ?? perfilByUserId.get(usuario.id) ?? "corretor",
    }))
    .filter((usuario) => usuario.perfil === "corretor" && inViewerScope(viewer, usuario.equipe_id));

  const usuarioIds = new Set(usuarios.map((usuario) => usuario.id));
  const usuarioById = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const usuarioByBitrixId = new Map(
    usuarios
      .filter((usuario) => Boolean(usuario.bitrix_user_id))
      .map((usuario) => [String(usuario.bitrix_user_id), usuario]),
  );

  const roletas = roletasResult.data ?? [];
  const roletaById = new Map(roletas.map((roleta) => [roleta.id, roleta]));

  const diretoriaIds = [...new Set(
    equipes
      .map((equipe) => String(equipe.bitrix_diretoria_id ?? "").trim())
      .filter(Boolean),
  )];

  const oportunidades = oportunidadesRows
    .map((item) => {
      const currentBroker = item.bitrix_assigned_by_id
        ? usuarioByBitrixId.get(String(item.bitrix_assigned_by_id))
        : null;
      const normalized = {
        ...item,
        corretor_id: currentBroker?.id ?? (item.bitrix_assigned_by_id ? null : item.corretor_id),
      };
      return {
        ...normalized,
        status: mapOportunidadeStatus(normalized),
      };
    })
    .filter((item) => !item.corretor_id || usuarioIds.has(item.corretor_id));

  const filterOptions: DashboardFilterOptions = {
    esteiras: [{
      id: String(comercialGeralCategoryId),
      label: labelEsteira(String(comercialGeralCategoryId)),
    }],
    diretorias: diretoriaIds.map((id) => ({ id, label: `Diretoria ${diretoriaLabel}` })),
    equipes: equipes.map((equipe) => ({
      id: equipe.id,
      nome: equipe.nome,
      diretoriaId: equipe.bitrix_diretoria_id,
    })),
    corretores: usuarios
      .map((usuario) => ({
        id: usuario.id,
        nome: usuario.nome,
        equipeId: usuario.equipe_id,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    roletas: buildRoletaAtualOptions(oportunidades),
  };

  const bloqueados = new Set((bloqueiosResult.data ?? []).map((item) => item.corretor_id));
  const emAuditoria = new Set((auditoriasResult.data ?? []).map((item) => item.corretor_id));

  return {
    admin,
    comercialGeralCategoryId,
    bloqueados,
    emAuditoria,
    equipeById,
    equipeIdsForDiretoria,
    filterOptions,
    oportunidades,
    roletas,
    roletaById,
    roletasCorretorResult,
    usuarioById,
    usuarioIds,
    usuarios,
  };
}

function applyDimensionFilters(
  items: ReturnType<typeof loadSharedDashboardContext> extends Promise<infer T>
    ? T extends { oportunidades: infer O }
      ? O
      : never
    : never,
  filters: DashboardFilters,
  context: Awaited<ReturnType<typeof loadSharedDashboardContext>>,
) {
  let filtered = items;

  if (filters.corretor) {
    filtered = filtered.filter((item) => item.corretor_id === filters.corretor);
  }

  if (filters.roleta) {
    filtered = filtered.filter((item) => roletaAtualLabel(item.roleta_atual) === filters.roleta);
  }

  if (filters.equipe) {
    const equipeUserIds = new Set(
      context.usuarios
        .filter((usuario) => usuario.equipe_id === filters.equipe)
        .map((usuario) => usuario.id),
    );
    filtered = filtered.filter((item) => item.corretor_id && equipeUserIds.has(item.corretor_id));
  }

  if (filters.diretoria) {
    const equipeIds = context.equipeIdsForDiretoria(filters.diretoria);
    const equipeUserIds = new Set(
      context.usuarios
        .filter((usuario) => usuario.equipe_id && equipeIds.has(usuario.equipe_id))
        .map((usuario) => usuario.id),
    );
    filtered = filtered.filter((item) => item.corretor_id && equipeUserIds.has(item.corretor_id));
  }

  return filtered;
}

async function loadDashboardFromTables(viewer: ViewerContext, filters: DashboardFilters): Promise<DashboardData> {
  const context = await loadSharedDashboardContext(viewer);
  const inicioIso = startOfDayIso(filters.de);
  const fimIso = endOfDayIso(filters.ate);
  const periodoDias = dashboardPeriodDays(filters);
  const esteiraAtiva = context.comercialGeralCategoryId;

  const scoped = applyDimensionFilters(context.oportunidades, filters, context);
  const noPeriodo = scoped.filter((item) => {
    const date = entryDate(item);
    return date >= inicioIso && date <= fimIso;
  });

  const noPeriodoEsteira = noPeriodo.filter((item) =>
    matchesEsteira(item, esteiraAtiva, context.roletaById),
  );

  const recebidos = noPeriodoEsteira.length;
  const perdidos = noPeriodoEsteira.filter((item) => item.status === "perdida").length;
  const ativos = Math.max(0, recebidos - perdidos);
  const percentualPerdidos = recebidos === 0 ? 0 : Math.round((perdidos / recebidos) * 1000) / 10;

  const corretoresNoRecorte = new Set(
    context.usuarios
      .filter((usuario) => !filters.corretor || usuario.id === filters.corretor)
      .filter((usuario) => !filters.equipe || usuario.equipe_id === filters.equipe)
      .filter((usuario) => {
        if (!filters.diretoria) return true;
        return Boolean(
          usuario.equipe_id
          && context.equipeIdsForDiretoria(filters.diretoria).has(usuario.equipe_id),
        );
      })
      .map((usuario) => usuario.id),
  );
  const roletaIdsNoRecorte = filters.roleta
    ? new Set(
        context.roletas
          .filter((roleta) => (
            roletaAtualLabel(roleta.bitrix_roleta_valor) === filters.roleta
            || roletaAtualLabel(roleta.nome) === filters.roleta
          ))
          .map((roleta) => roleta.id),
      )
    : null;
  const corretoresComRoleta = new Set(
    (context.roletasCorretorResult.data ?? [])
      .filter((item) => !roletaIdsNoRecorte || roletaIdsNoRecorte.has(item.roleta_id))
      .map((item) => item.corretor_id)
      .filter((corretorId) => corretoresNoRecorte.has(corretorId)),
  );

  const inicio = new Date(inicioIso);
  const serie = Array.from({ length: periodoDias }, (_, index) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + index);
    const chave = dia.toISOString().slice(0, 10);
    const doDia = noPeriodoEsteira.filter((item) => entryDate(item).slice(0, 10) === chave);
    return {
      data: chave,
      recebidos: doDia.length,
      perdidos: doDia.filter((item) => item.status === "perdida").length,
    };
  });

  const equipeCounts = new Map<string, number>();
  for (const item of noPeriodoEsteira) {
    const corretor = item.corretor_id ? context.usuarioById.get(item.corretor_id) : null;
    const nome = corretor?.equipe_nome?.trim();
    if (!nome) continue;
    equipeCounts.set(nome, (equipeCounts.get(nome) ?? 0) + 1);
  }
  const porEquipe = [...equipeCounts.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  const esteiraStages = await fetchBitrixDealStages(esteiraAtiva).catch(() => []);

  const stageCounts = new Map<string, number>();
  for (const item of noPeriodoEsteira) {
    const stageId = stripStageSemanticSuffix(item.bitrix_stage_id);
    if (!stageId) continue;
    stageCounts.set(stageId, (stageCounts.get(stageId) ?? 0) + 1);
  }

  const stageMeta = new Map(esteiraStages.map((stage) => [stage.id, stage]));
  const knownStageIds = esteiraStages.map((stage) => stage.id);
  const unknownStageIds = [...stageCounts.keys()]
    .filter((id) => !stageMeta.has(id))
    .sort((a, b) => a.localeCompare(b));

  const orderedStageIds = knownStageIds.length
    ? [...knownStageIds, ...unknownStageIds]
    : [...stageCounts.keys()].sort((a, b) => (stageCounts.get(b) ?? 0) - (stageCounts.get(a) ?? 0));

  let gargaloId: string | null = null;
  let gargaloTotal = 0;
  for (const stageId of orderedStageIds) {
    const meta = stageMeta.get(stageId);
    if (meta?.semantics === "S" || meta?.semantics === "F") continue;
    const total = stageCounts.get(stageId) ?? 0;
    if (total > gargaloTotal) {
      gargaloTotal = total;
      gargaloId = stageId;
    }
  }

  const funilTotal = [...stageCounts.values()].reduce((sum, value) => sum + value, 0);
  const funil = orderedStageIds
    .map((stageId) => {
      const meta = stageMeta.get(stageId);
      const total = stageCounts.get(stageId) ?? 0;
      return {
        status: stageId,
        label: meta?.name ?? stageId.replace(/^C\d+:/, ""),
        total,
        gargalo: stageId === gargaloId && gargaloTotal > 0,
      };
    })
    .filter((item) => item.total > 0 || Boolean(stageMeta.get(item.status)));

  const roletaCounts = new Map<string, { ativos: number; perdidos: number }>();
  for (const item of noPeriodoEsteira) {
    const nome = roletaAtualLabel(item.roleta_atual);
    if (!nome) continue;
    const current = roletaCounts.get(nome) ?? { ativos: 0, perdidos: 0 };
    if (item.status === "perdida") current.perdidos += 1;
    else if ((STATUS_ATIVOS as readonly string[]).includes(item.status)) current.ativos += 1;
    roletaCounts.set(nome, current);
  }
  const porRoleta = [...roletaCounts.entries()]
    .map(([nome, counts]) => ({ nome, ...counts }))
    .filter((item) => item.ativos + item.perdidos > 0)
    .sort((a, b) => (b.ativos + b.perdidos) - (a.ativos + a.perdidos) || a.nome.localeCompare(b.nome, "pt-BR"));

  const criticalBefore = Date.now() - (3 * 86_400_000);
  const corretores = context.usuarios
    .filter((usuario) => !filters.corretor || usuario.id === filters.corretor)
    .filter((usuario) => !filters.equipe || usuario.equipe_id === filters.equipe)
    .filter((usuario) => {
      if (!filters.diretoria) return true;
      return Boolean(usuario.equipe_id && context.equipeIdsForDiretoria(filters.diretoria).has(usuario.equipe_id));
    })
    .map((usuario) => {
      const items = noPeriodoEsteira.filter((item) => item.corretor_id === usuario.id);
      const criticos = items.filter((item) => {
        if (item.status === "perdida" || item.status === "convertida") return false;
        const updatedAt = Date.parse(item.ultima_atualizacao_bitrix ?? entryDate(item));
        return !Number.isNaN(updatedAt) && updatedAt <= criticalBefore;
      }).length;
      const ultimaAtividade = items.reduce<string | null>((latest, item) => {
        const value = item.ultima_atualizacao_bitrix ?? entryDate(item);
        return !latest || value > latest ? value : latest;
      }, null);

      return {
        id: usuario.id,
        nome: usuario.nome,
        equipe: usuario.equipe_nome?.trim() || "Sem equipe",
        foto_url: usuario.foto_url?.trim() || null,
        status: context.bloqueados.has(usuario.id)
          ? "bloqueado"
          : context.emAuditoria.has(usuario.id)
            ? "auditoria"
            : "liberado",
        total: items.length,
        ativos: items.filter((item) => item.status !== "perdida").length,
        perdidos: items.filter((item) => item.status === "perdida").length,
        criticos,
        roletas: [...new Set(items.map((item) => roletaAtualLabel(item.roleta_atual)).filter(Boolean) as string[])]
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
        ultima_atividade: ultimaAtividade,
      };
    })
    .filter((corretor) => corretor.total > 0 || !filters.roleta)
    .sort((a, b) => b.criticos - a.criticos || b.ativos - a.ativos || a.nome.localeCompare(b.nome, "pt-BR"));

  const leadsCriticos = corretores.reduce((total, corretor) => total + corretor.criticos, 0);

  const gargaloLabel = gargaloId
    ? (stageMeta.get(gargaloId)?.name ?? gargaloId.replace(/^C\d+:/, ""))
    : null;

  return dashboardSchema.parse({
    recebidos,
    perdidos,
    ativos,
    percentual_perdidos: percentualPerdidos,
    corretores_ativos_roleta: corretoresComRoleta.size,
    leads_criticos: leadsCriticos,
    periodo_dias: periodoDias,
    gerado_em: new Date().toISOString(),
    serie,
    por_equipe: porEquipe,
    funil,
    gargalo_label: gargaloLabel,
    gargalo_total: gargaloTotal,
    gargalo_percentual: funilTotal === 0 || gargaloTotal === 0
      ? 0
      : Math.round((gargaloTotal / funilTotal) * 1000) / 10,
    por_roleta: porRoleta,
    corretores,
  });
}

export async function getDashboardFilterOptions(): Promise<DashboardFilterOptions> {
  if (!hasSupabaseEnv() || !hasSupabaseSecretKey()) {
    return emptyFilterOptions;
  }

  const viewer = await getViewerContext();
  if (!viewer || !canManageOperacao(viewer.perfil)) {
    return emptyFilterOptions;
  }

  const context = await loadSharedDashboardContext(viewer);
  return context.filterOptions;
}

export async function getDashboardData(filters: DashboardFilters = defaultDashboardFilters()): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return emptyDashboard(filters);
  }

  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    throw new Error("Não foi possível carregar o dashboard: perfil sem permissão.");
  }

  if (!viewer) {
    throw new Error("Não foi possível carregar o dashboard: sessão inválida.");
  }

  if (!hasSupabaseSecretKey()) {
    throw new Error("Não foi possível carregar o dashboard: chave secreta do Supabase ausente.");
  }

  return loadDashboardFromTables(viewer, filters);
}
