import "server-only";

import { bitrixCallJson, hasBitrixEnv } from "@/lib/bitrix/client";
import { normalizeBitrixStageColor } from "@/lib/bitrix/stage-color";

export type BitrixDealStage = {
  id: string;
  name: string;
  sort: number;
  semantics: "S" | "F" | "P" | null;
  color: string | null;
};

type StatusRow = {
  STATUS_ID?: string;
  NAME?: string;
  SORT?: string | number;
  SEMANTICS?: string | null;
  COLOR?: string | null;
};

function normalizeSemantics(value: string | null | undefined): BitrixDealStage["semantics"] {
  const semantic = String(value ?? "").toUpperCase();
  if (semantic === "S" || semantic === "F" || semantic === "P") return semantic;
  return null;
}

export async function fetchBitrixDealStages(categoryId: string): Promise<BitrixDealStage[]> {
  if (!hasBitrixEnv()) return [];

  const entityId = `DEAL_STAGE_${categoryId}`;
  const rows = await bitrixCallJson<StatusRow[]>("crm.status.list", {
    filter: { ENTITY_ID: entityId },
    order: { SORT: "ASC" },
  });

  const prefix = `C${categoryId}:`;
  const stages = new Map<string, BitrixDealStage>();
  for (const row of rows ?? []) {
    const id = String(row.STATUS_ID ?? "");
    if (!id.startsWith(prefix) || stages.has(id)) continue;
    stages.set(id, {
      id,
      name: String(row.NAME ?? id),
      sort: Number(row.SORT ?? 0),
      semantics: normalizeSemantics(row.SEMANTICS),
      color: normalizeBitrixStageColor(row.COLOR),
    });
  }
  return [...stages.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "pt-BR"));
}

export function stripStageSemanticSuffix(stageId: string | null | undefined) {
  return String(stageId ?? "").split("#")[0].trim();
}
