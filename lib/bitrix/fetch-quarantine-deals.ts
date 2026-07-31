import "server-only";

import { cached } from "@/lib/bitrix/cache";
import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";
import { DEAL_STATUS_FIELD, isDealQuarantineStatus } from "@/lib/bitrix/team-critical";

type RawDeal = {
  ID?: string | number;
  TITLE?: string;
  STAGE_ID?: string;
  STAGE_SEMANTIC_ID?: string;
  CATEGORY_ID?: string | number;
  ASSIGNED_BY_ID?: string | number;
  DATE_CREATE?: string;
  DATE_MODIFY?: string;
  [key: string]: unknown;
};

export type QuarantineDeal = {
  bitrixDealId: string;
  titulo: string;
  stageId: string;
  stageSemantic: string;
  categoryId: string;
  assignedById: string;
  dateCreate: string | null;
  dateModify: string | null;
};

const SELECT_FIELDS = [
  "ID",
  "TITLE",
  "STAGE_ID",
  "STAGE_SEMANTIC_ID",
  "CATEGORY_ID",
  "ASSIGNED_BY_ID",
  "DATE_CREATE",
  "DATE_MODIFY",
  DEAL_STATUS_FIELD,
];

const MAX_PAGES = 60;
const PAGE_SIZE = 50;

function toQuarantineDeal(deal: RawDeal): QuarantineDeal | null {
  const bitrixDealId = String(deal.ID ?? "").trim();
  if (!bitrixDealId) return null;
  return {
    bitrixDealId,
    titulo: String(deal.TITLE ?? "").trim(),
    stageId: String(deal.STAGE_ID ?? "").trim(),
    stageSemantic: String(deal.STAGE_SEMANTIC_ID ?? "").trim(),
    categoryId: String(deal.CATEGORY_ID ?? "").trim(),
    assignedById: String(deal.ASSIGNED_BY_ID ?? "").trim(),
    dateCreate: String(deal.DATE_CREATE ?? "").trim() || null,
    dateModify: String(deal.DATE_MODIFY ?? "").trim() || null,
  };
}

async function listOpenDeals(categoryId: string, statusFilter: string | null) {
  const output: QuarantineDeal[] = [];
  let start = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: Record<string, string> = {
      "filter[=CATEGORY_ID]": categoryId,
      "filter[CLOSED]": "N",
      start: String(start),
      "order[ID]": "ASC",
    };
    if (statusFilter) query[`filter[=${DEAL_STATUS_FIELD}]`] = statusFilter;
    SELECT_FIELDS.forEach((field, index) => { query[`select[${index}]`] = field; });

    const response = await bitrixCallPage<RawDeal[]>("crm.deal.list", new URLSearchParams(query), 30_000);
    for (const deal of response.result) {
      if (!isDealQuarantineStatus(deal[DEAL_STATUS_FIELD] ?? deal.UF_CRM_1717073472)) continue;
      const mapped = toQuarantineDeal(deal);
      if (mapped) output.push(mapped);
    }
    if (typeof response.next !== "number") break;
    start = response.next;
    if (response.result.length < PAGE_SIZE) break;
  }

  return output;
}

/**
 * O filtro por valor do campo de status pode falhar quando o portal usa outro ID de lista,
 * então a varredura completa dos negócios abertos garante o mesmo número exibido em Equipes.
 */
export async function fetchQuarantineDeals(categoryId: string): Promise<QuarantineDeal[]> {
  if (!hasBitrixEnv() || !categoryId) return [];

  return cached(`resultados:quarentena:${categoryId}`, 60_000, async () => {
    return listOpenDeals(categoryId, null).catch(() => []);
  });
}
