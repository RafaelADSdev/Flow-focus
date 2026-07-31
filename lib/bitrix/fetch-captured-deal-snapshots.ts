import "server-only";

import { mapLimit } from "@/lib/bitrix/cache";
import { bitrixCall, bitrixCallJson, hasBitrixEnv } from "@/lib/bitrix/client";
import { DEAL_STATUS_FIELD, isDealQuarantineStatus, isWonDealStage } from "@/lib/bitrix/team-critical";

type JsonRecord = Record<string, unknown>;

export type CapturedDealSnapshot = {
  bitrixDealId: string;
  titulo: string;
  stageId: string;
  stageSemantic: string;
  categoryId: string;
  dateModify: string | null;
  dealStatus: string | number | null;
};

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function toSnapshot(deal: JsonRecord): CapturedDealSnapshot | null {
  const bitrixDealId = String(deal.ID ?? "").trim();
  if (!bitrixDealId) return null;
  return {
    bitrixDealId,
    titulo: String(deal.TITLE ?? "").trim(),
    stageId: String(deal.STAGE_ID ?? "").trim(),
    stageSemantic: String(deal.STAGE_SEMANTIC_ID ?? "").trim(),
    categoryId: String(deal.CATEGORY_ID ?? "").trim(),
    dateModify: String(deal.DATE_MODIFY ?? "").trim() || null,
    dealStatus: (deal[DEAL_STATUS_FIELD] ?? deal.UF_CRM_1717073472 ?? null) as string | number | null,
  };
}

async function fetchDealBatch(ids: string[]) {
  try {
    const result = await bitrixCallJson<JsonRecord[]>("crm.deal.list", {
      filter: { "@ID": ids },
      select: ["ID", "TITLE", "STAGE_ID", "STAGE_SEMANTIC_ID", "DATE_MODIFY", "CATEGORY_ID", DEAL_STATUS_FIELD],
    });
    return (result ?? []).map(toSnapshot).filter((item): item is CapturedDealSnapshot => Boolean(item));
  } catch {
    const deals = await mapLimit(ids, 4, async (id) => {
      try {
        return await bitrixCall<JsonRecord>("crm.deal.get", new URLSearchParams({ ID: id }));
      } catch {
        return null;
      }
    });
    return deals.map((deal) => deal ? toSnapshot(deal) : null).filter((item): item is CapturedDealSnapshot => Boolean(item));
  }
}

export async function fetchCapturedDealSnapshots(dealIds: string[]) {
  const uniqueIds = [...new Set(dealIds.map((id) => id.trim()).filter(Boolean))];
  const output = new Map<string, CapturedDealSnapshot>();
  if (!hasBitrixEnv() || !uniqueIds.length) return output;

  for (const batch of chunks(uniqueIds, 50)) {
    const snapshots = await fetchDealBatch(batch);
    for (const snapshot of snapshots) output.set(snapshot.bitrixDealId, snapshot);
  }

  return output;
}

export function isQuarantineSnapshot(snapshot: CapturedDealSnapshot) {
  return isDealQuarantineStatus(snapshot.dealStatus);
}

export function isSignedContractSnapshot(snapshot: CapturedDealSnapshot) {
  return isWonDealStage(snapshot.stageId, snapshot.stageSemantic);
}
