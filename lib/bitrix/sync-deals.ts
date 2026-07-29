import "server-only";

import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";
import { getBolsaoSyncDefaults } from "@/lib/bitrix/bolsao-roleta";
import { upsertBolsaoRoletasBatch } from "@/lib/bitrix/upsert-bolsao-roleta";
import type { StatusOportunidade } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export type BitrixDealsSyncSummary = {
  encontrados: number;
  importados: number;
  ignorados: number;
  removidosDaFila: number;
  roletas: number;
  /** Total Bitrix com tag Focus na category (qualquer etapa) — ajuda a explicar gap vs Bolsão. */
  focusNaCategory: number | null;
};

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function getSyncConfig() {
  const defaults = getBolsaoSyncDefaults();
  return {
    ...defaults,
    rouletteField: process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972",
  };
}

function rouletteValue(deal: JsonRecord, rouletteField: string) {
  const value = deal[rouletteField];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
}

function isEligible(
  deal: JsonRecord,
  config: ReturnType<typeof getSyncConfig>,
) {
  return String(deal.CATEGORY_ID ?? "") === config.categoryId
    && String(deal.STAGE_ID ?? "") === config.stageId
    && rouletteValue(deal, config.rouletteField).toLocaleLowerCase().includes(config.rouletteTag.toLocaleLowerCase());
}

function opportunityStatus(
  deal: JsonRecord,
  config: ReturnType<typeof getSyncConfig>,
  existing?: { corretor_id: string | null; status: string | null } | null,
): StatusOportunidade {
  if (isEligible(deal, config)) {
    if (existing?.corretor_id) {
      const current = existing.status;
      if (current === "captada" || current === "em_trabalho" || current === "convertida" || current === "perdida") {
        return current;
      }
      return "captada";
    }
    return "disponivel";
  }
  const semantic = String(deal.STAGE_SEMANTIC_ID ?? "");
  if (semantic === "S") return "convertida";
  if (semantic === "F") return "perdida";
  return existing?.corretor_id ? "em_trabalho" : "perdida";
}

function dealSelectFields(config: ReturnType<typeof getSyncConfig>) {
  return [
    "ID",
    "TITLE",
    "CATEGORY_ID",
    "STAGE_ID",
    "STAGE_SEMANTIC_ID",
    "OPPORTUNITY",
    "ASSIGNED_BY_ID",
    "DATE_CREATE",
    "DATE_MODIFY",
    config.rouletteField,
  ];
}

async function fetchDealPage(
  start: number,
  config: ReturnType<typeof getSyncConfig>,
  filters: Record<string, string>,
) {
  const params = new URLSearchParams({
    ...filters,
    start: String(start),
  });
  dealSelectFields(config).forEach((field) => params.append("select[]", field));
  return bitrixCallPage<JsonRecord[]>("crm.deal.list", params, 30_000);
}

/** Percorre todas as páginas pelo cursor `next` do Bitrix (não confia só em total/50). */
async function fetchAllPages(
  config: ReturnType<typeof getSyncConfig>,
  filters: Record<string, string>,
) {
  const deals: JsonRecord[] = [];
  let start: number | undefined = 0;
  let reportedTotal: number | null = null;

  while (start !== undefined) {
    const page = await fetchDealPage(start, config, filters);
    if (reportedTotal === null && typeof page.total === "number") {
      reportedTotal = page.total;
    }
    deals.push(...page.result);
    start = typeof page.next === "number" ? page.next : undefined;
  }

  return { deals, reportedTotal };
}

async function countFocusInCategory(config: ReturnType<typeof getSyncConfig>) {
  try {
    const page = await fetchDealPage(0, config, {
      "filter[CATEGORY_ID]": config.categoryId,
      [`filter[=%${config.rouletteField}]`]: `%${config.rouletteTag}%`,
    });
    return typeof page.total === "number" ? page.total : page.result.length;
  } catch {
    return null;
  }
}

async function removeStaleFromQueue(
  admin: ReturnType<typeof createAdminClient>,
  categoryId: string,
  syncedIds: Set<string>,
) {
  const { data: bolsaoRoletas, error: roletasError } = await admin
    .from("roletas")
    .select("id")
    .eq("bitrix_category_id", categoryId)
    .eq("ativa", true);

  if (roletasError || !bolsaoRoletas?.length) return 0;

  const roletaIds = bolsaoRoletas.map((item) => item.id);
  const { data: stillAvailable, error: availableError } = await admin
    .from("oportunidades")
    .select("id,bitrix_deal_id")
    .in("roleta_id", roletaIds)
    .is("corretor_id", null)
    .is("captada_em", null);

  if (availableError || !stillAvailable) return 0;

  const staleIds = stillAvailable
    .filter((item) => item.bitrix_deal_id && !syncedIds.has(item.bitrix_deal_id))
    .map((item) => item.id);

  if (!staleIds.length) return 0;

  for (const batch of chunks(staleIds, 250)) {
    let { error } = await admin.from("oportunidades").update({ status: "perdida" }).in("id", batch);
    if (error?.message.includes("status")) {
      ({ error } = await admin.from("oportunidades").delete().in("id", batch));
    }
    if (error) throw error;
  }

  return staleIds.length;
}

let syncInFlight: Promise<BitrixDealsSyncSummary> | null = null;

export async function syncBitrixDeals(): Promise<BitrixDealsSyncSummary> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = runSyncBitrixDeals().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

async function runSyncBitrixDeals(): Promise<BitrixDealsSyncSummary> {
  if (!hasBitrixEnv()) {
    throw new Error("BITRIX24_BASE_URL não configurada.");
  }

  const config = getSyncConfig();
  const admin = createAdminClient();

  const [{ deals, reportedTotal }, focusNaCategory] = await Promise.all([
    fetchAllPages(config, {
      "filter[CATEGORY_ID]": config.categoryId,
      "filter[STAGE_ID]": config.stageId,
      [`filter[=%${config.rouletteField}]`]: `%${config.rouletteTag}%`,
    }),
    countFocusInCategory(config),
  ]);

  const eligible = deals.filter((deal) => isEligible(deal, config));
  const total = reportedTotal ?? eligible.length;

  const roletaAtualValues = eligible.map((deal) => rouletteValue(deal, config.rouletteField));
  const roletaIdByValor = await upsertBolsaoRoletasBatch(admin, roletaAtualValues, config);

  const dealIds = eligible.map((deal) => String(deal.ID));
  const existingRows = (await Promise.all(chunks(dealIds, 300).map(async (ids) => {
    const { data, error } = await admin
      .from("oportunidades")
      .select("bitrix_deal_id,corretor_id,status")
      .in("bitrix_deal_id", ids);
    if (error) {
      if (error.message.includes("status")) {
        const fallback = await admin
          .from("oportunidades")
          .select("bitrix_deal_id,corretor_id")
          .in("bitrix_deal_id", ids);
        if (fallback.error) throw fallback.error;
        return (fallback.data ?? []).map((item) => ({ ...item, status: null }));
      }
      throw error;
    }
    return data ?? [];
  }))).flat();

  const existingOpportunities = new Map(existingRows.map((item) => [item.bitrix_deal_id, item]));

  const opportunities = eligible.map((deal) => {
    const dealId = String(deal.ID);
    const value = rouletteValue(deal, config.rouletteField);
    const roletaId = roletaIdByValor.get(value);
    if (!roletaId) {
      throw new Error(`Roleta não resolvida para valor: ${value}`);
    }

    return {
      bitrix_deal_id: dealId,
      roleta_id: roletaId,
      titulo: String(deal.TITLE ?? `Negocio #${dealId}`),
      valor: Number(deal.OPPORTUNITY ?? 0),
      status: opportunityStatus(deal, config, existingOpportunities.get(dealId)),
      roleta_atual: value,
      bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
      bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
      data_criacao_bitrix: String(deal.DATE_CREATE ?? "") || null,
      ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
    };
  });

  await Promise.all(chunks(opportunities, 250).map(async (batch) => {
    let { error } = await admin.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });
    if (error?.message.includes("status") || error?.message.includes("bitrix_assigned") || error?.message.includes("roleta_atual")) {
      const slim = batch.map(({ status: _status, bitrix_assigned_by_id: _assigned, roleta_atual: _roleta, ...rest }) => rest);
      ({ error } = await admin.from("oportunidades").upsert(slim, { onConflict: "bitrix_deal_id" }));
    }
    if (error) throw error;
  }));

  const syncedIds = new Set(dealIds);
  const removidosDaFila = await removeStaleFromQueue(admin, config.categoryId, syncedIds);

  return {
    encontrados: total,
    importados: eligible.length,
    ignorados: deals.length - eligible.length,
    removidosDaFila,
    roletas: roletaIdByValor.size,
    focusNaCategory,
  };
}
