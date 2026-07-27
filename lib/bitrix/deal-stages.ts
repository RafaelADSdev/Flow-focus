import "server-only";

import { bitrixCallJson, hasBitrixEnv } from "@/lib/bitrix/client";

export type BitrixDealStage = {
  id: string;
  name: string;
  sort: number;
  semantics: "S" | "F" | "P" | null;
};

type StatusRow = {
  STATUS_ID?: string;
  NAME?: string;
  SORT?: string | number;
  SEMANTICS?: string | null;
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
  return (rows ?? [])
    .filter((row) => String(row.STATUS_ID ?? "").startsWith(prefix))
    .map((row) => ({
      id: String(row.STATUS_ID),
      name: String(row.NAME ?? row.STATUS_ID),
      sort: Number(row.SORT ?? 0),
      semantics: normalizeSemantics(row.SEMANTICS),
    }))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "pt-BR"));
}

export function stripStageSemanticSuffix(stageId: string | null | undefined) {
  return String(stageId ?? "").split("#")[0].trim();
}
