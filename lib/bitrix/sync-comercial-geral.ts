import "server-only";

import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export type ComercialGeralSyncSummary = {
  categoryId: string;
  periodo: { de: string; ate: string };
  meses: number;
  encontrados: number;
  baixados: number;
  elegiveis: number;
  importados: number;
  com_corretor: number;
  roleta_id: string;
};

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function listComercialGeralMonthPeriods(year = Number(process.env.YEAR ?? new Date().getFullYear())) {
  const now = new Date();
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;

  return Array.from({ length: lastMonth + 1 }, (_, month) => {
    const from = new Date(year, month, 1, 0, 0, 0);
    const to = year === now.getFullYear() && month === now.getMonth()
      ? now
      : new Date(year, month + 1, 0, 23, 59, 59);

    return {
      label: `${year}-${String(month + 1).padStart(2, "0")}`,
      dateFrom: from.toISOString().slice(0, 19),
      dateTo: to.toISOString().slice(0, 19),
    };
  });
}

function getSyncConfig() {
  const currentYear = new Date().getFullYear();
  const requestedYear = process.env.YEAR ? Number(process.env.YEAR) : null;
  const startYear = requestedYear ?? Number(
    process.env.BITRIX24_COMERCIAL_SYNC_START_YEAR ?? currentYear - 1,
  );
  const endYear = requestedYear ?? currentYear;
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > endYear) {
    throw new Error("BITRIX24_COMERCIAL_SYNC_START_YEAR deve ser um ano válido.");
  }
  const months = Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => listComercialGeralMonthPeriods(startYear + index),
  ).flat();
  return {
    categoryId: process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16",
    rouletteField: process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972",
    rouletteTag: process.env.BITRIX24_ROULETTE_TAG ?? "Focus",
    startYear,
    endYear,
    months,
  };
}

function rouletteValue(deal: JsonRecord, rouletteField: string) {
  const value = deal[rouletteField];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
}

function isFocusDeal(deal: JsonRecord, config: ReturnType<typeof getSyncConfig>) {
  return String(deal.CATEGORY_ID ?? "") === config.categoryId
    && rouletteValue(deal, config.rouletteField).toLocaleLowerCase().includes(config.rouletteTag.toLocaleLowerCase());
}

function stageWithSemantic(deal: JsonRecord) {
  const stage = String(deal.STAGE_ID ?? "").trim();
  const semantic = String(deal.STAGE_SEMANTIC_ID ?? "").trim().toUpperCase();
  if (!stage) return semantic ? `#${semantic}` : null;
  if (!semantic) return stage;
  return `${stage}#${semantic}`;
}

async function fetchComercialGeralPage(
  start: number,
  config: ReturnType<typeof getSyncConfig>,
  period: { dateFrom: string; dateTo: string },
) {
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
    [`filter[=%${config.rouletteField}]`]: `%${config.rouletteTag}%`,
    "filter[>=DATE_CREATE]": period.dateFrom,
    "filter[<=DATE_CREATE]": period.dateTo,
    start: String(start),
  });
  dealFields.forEach((field) => params.append("select[]", field));

  return bitrixCallPage<JsonRecord[]>("crm.deal.list", params, 45_000);
}

async function fetchMonthDeals(config: ReturnType<typeof getSyncConfig>, period: { label: string; dateFrom: string; dateTo: string }) {
  const first = await fetchComercialGeralPage(0, config, period);
  const total = first.total ?? first.result.length;
  const starts = Array.from({ length: Math.max(0, Math.ceil(total / 50) - 1) }, (_, index) => (index + 1) * 50);
  const deals = [...first.result];

  for (const start of starts) {
    const page = await fetchComercialGeralPage(start, config, period);
    deals.push(...page.result);
    await sleep(400);
  }

  return { total, deals };
}

let syncInFlight: Promise<ComercialGeralSyncSummary> | null = null;

export function syncComercialGeralDeals(): Promise<ComercialGeralSyncSummary> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncComercialGeralDeals().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSyncComercialGeralDeals(): Promise<ComercialGeralSyncSummary> {
  if (!hasBitrixEnv()) {
    throw new Error("BITRIX24_BASE_URL não configurada.");
  }

  const config = getSyncConfig();
  const admin = createAdminClient();

  const funilId = `${config.categoryId}:*:${config.rouletteTag.toLocaleLowerCase()}:dashboard`;
  const { data: roulette, error: rouletteError } = await admin
    .from("roletas")
    .upsert(
      {
        nome: "Comercial Geral · Focus",
        bitrix_funil_id: funilId,
        bitrix_category_id: String(config.categoryId),
        bitrix_roleta_valor: config.rouletteTag,
        descricao: `Histórico Focus da category ${config.categoryId} para Visão geral (${config.startYear}-${config.endYear})`,
        ativa: true,
      },
      { onConflict: "bitrix_funil_id" },
    )
    .select("id")
    .single();

  if (rouletteError) throw rouletteError;

  const { data: usuarios, error: usuariosError } = await admin
    .from("usuarios")
    .select("id, bitrix_user_id")
    .not("bitrix_user_id", "is", null);

  if (usuariosError) throw usuariosError;

  const corretorByBitrixId = new Map(
    (usuarios ?? []).map((usuario) => [String(usuario.bitrix_user_id), usuario.id]),
  );

  let encontrados = 0;
  let baixados = 0;
  let elegiveis = 0;
  let importados = 0;
  let comCorretor = 0;

  for (const period of config.months) {
    const monthResult = await fetchMonthDeals(config, period);
    encontrados += monthResult.total;
    baixados += monthResult.deals.length;

    const eligible = monthResult.deals.filter((deal) => isFocusDeal(deal, config));
    elegiveis += eligible.length;
    if (!eligible.length) continue;

    const dealIds = eligible.map((deal) => String(deal.ID));
    const existingRows = (await Promise.all(chunks(dealIds, 300).map(async (ids) => {
      const { data, error } = await admin
        .from("oportunidades")
        .select("bitrix_deal_id, roleta_id, corretor_id, captada_em")
        .in("bitrix_deal_id", ids);
      if (error) throw error;
      return data ?? [];
    }))).flat();
    const existingByDeal = new Map(existingRows.map((row) => [row.bitrix_deal_id, row]));

    const rows = eligible.map((deal) => {
      const dealId = String(deal.ID);
      const existing = existingByDeal.get(dealId);
      const assigned = String(deal.ASSIGNED_BY_ID ?? "") || null;
      const mappedCorretor = assigned ? corretorByBitrixId.get(assigned) ?? null : null;
      const corretorId = existing?.corretor_id ?? mappedCorretor;
      const value = rouletteValue(deal, config.rouletteField);
      const dateCreate = String(deal.DATE_CREATE ?? "") || null;
      const captadaEm = existing?.captada_em ?? null;
      if (corretorId) comCorretor += 1;

      return {
        bitrix_deal_id: dealId,
        roleta_id: existing?.roleta_id ?? roulette.id,
        titulo: String(deal.TITLE ?? `Negócio #${dealId}`),
        valor: Number(deal.OPPORTUNITY ?? 0) || 0,
        roleta_atual: value || null,
        bitrix_stage_id: stageWithSemantic(deal),
        bitrix_assigned_by_id: assigned,
        data_criacao_bitrix: dateCreate,
        ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? dateCreate ?? new Date().toISOString()),
        corretor_id: corretorId,
        captada_em: captadaEm,
      };
    });

    for (const batch of chunks(rows, 200)) {
      const { error } = await admin.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });
      if (error) throw error;
      importados += batch.length;
    }

    await sleep(800);
  }

  const firstMonth = config.months[0];
  const lastMonth = config.months[config.months.length - 1];

  return {
    categoryId: config.categoryId,
    periodo: { de: firstMonth?.dateFrom ?? "", ate: lastMonth?.dateTo ?? "" },
    meses: config.months.length,
    encontrados,
    baixados,
    elegiveis,
    importados,
    com_corretor: comCorretor,
    roleta_id: roulette.id,
  };
}
