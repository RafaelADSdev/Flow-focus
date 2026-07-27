import "server-only";

import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";
import type { StatusOportunidade } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export type BitrixDealsSyncSummary = {
  encontrados: number;
  importados: number;
  ignorados: number;
  removidosDaFila: number;
  roletas: number;
};

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function getSyncConfig() {
  return {
    categoryId: process.env.BITRIX24_FILTER_CATEGORY_ID ?? "36",
    stageId: process.env.BITRIX24_FILTER_STAGE_ID ?? "C36:NEW",
    rouletteField: process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972",
    rouletteTag: process.env.BITRIX24_ROULETTE_TAG ?? process.env.BITRIX24_ROULETTE_SUFFIX ?? "Focus",
    poolName: process.env.BITRIX24_POOL_NAME ?? "Bolsão",
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

async function fetchEligiblePage(start: number, config: ReturnType<typeof getSyncConfig>) {
  const dealFields = [
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

  const params = new URLSearchParams({
    "filter[CATEGORY_ID]": config.categoryId,
    "filter[STAGE_ID]": config.stageId,
    [`filter[=%${config.rouletteField}]`]: `%${config.rouletteTag}%`,
    start: String(start),
  });
  dealFields.forEach((field) => params.append("select[]", field));

  return bitrixCallPage<JsonRecord[]>("crm.deal.list", params, 30_000);
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

  const first = await fetchEligiblePage(0, config);
  const total = first.total ?? first.result.length;
  const starts = Array.from({ length: Math.max(0, Math.ceil(total / 50) - 1) }, (_, index) => (index + 1) * 50);
  const deals = [...first.result];

  for (let index = 0; index < starts.length; index += 4) {
    const pages = await Promise.all(starts.slice(index, index + 4).map((start) => fetchEligiblePage(start, config)));
    pages.forEach((page) => deals.push(...page.result));
  }

  const eligible = deals.filter((deal) => isEligible(deal, config));

  const { data: roulette, error: rouletteError } = await admin.from("roletas").upsert({
    nome: config.poolName,
    bitrix_funil_id: `${config.categoryId}:${config.stageId}:${config.rouletteTag.toLocaleLowerCase()}`,
    bitrix_category_id: config.categoryId,
    bitrix_roleta_valor: config.rouletteTag,
    descricao: `Negócios em ${config.stageId} cuja Roleta Atual contém ${config.rouletteTag}`,
    ativa: true,
  }, { onConflict: "bitrix_funil_id" }).select("id").single();

  if (rouletteError) throw rouletteError;

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
    return {
      bitrix_deal_id: dealId,
      roleta_id: roulette.id,
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

  let removidosDaFila = 0;
  const syncedIds = new Set(dealIds);
  const { data: stillAvailable, error: availableError } = await admin
    .from("oportunidades")
    .select("id,bitrix_deal_id")
    .eq("roleta_id", roulette.id)
    .is("corretor_id", null)
    .is("captada_em", null);

  if (!availableError && stillAvailable) {
    const staleIds = stillAvailable
      .filter((item) => item.bitrix_deal_id && !syncedIds.has(item.bitrix_deal_id))
      .map((item) => item.id);

    if (staleIds.length) {
      for (const batch of chunks(staleIds, 250)) {
        let { error } = await admin.from("oportunidades").update({ status: "perdida" }).in("id", batch);
        if (error?.message.includes("status")) {
          ({ error } = await admin.from("oportunidades").delete().in("id", batch));
        }
        if (error) throw error;
      }
      removidosDaFila = staleIds.length;
    }
  }

  return {
    encontrados: total,
    importados: eligible.length,
    ignorados: deals.length - eligible.length,
    removidosDaFila,
    roletas: 1,
  };
}
