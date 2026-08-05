import { isDealQuarantineStatus } from "@/lib/bitrix/team-critical";
import type { StatusOportunidade } from "@/lib/database.types";
import type { ResultadoBucket } from "@/lib/types/resultados";

export type SystemCaptureSnapshot = {
  bitrixDealId: string;
  titulo: string;
  stageId: string;
  stageSemantic: string;
  categoryId: string;
  dateModify: string | null;
  dealStatus: string | number | null;
};

function isSignedContractSnapshot(snapshot: SystemCaptureSnapshot) {
  if (snapshot.stageSemantic.toUpperCase() === "S") return true;
  return /WON/i.test(snapshot.stageId);
}

function isQuarantineSnapshot(snapshot: SystemCaptureSnapshot) {
  return isDealQuarantineStatus(snapshot.dealStatus);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function configuredIds(value: string | undefined) {
  return new Set(String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

function classifyLocal(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
): Exclude<ResultadoBucket, "total" | "vendas" | "quarentena"> {
  const normalized = normalize(`${stage} ${stageId}`);
  const returnIds = configuredIds(
    process.env.BITRIX24_RETURN_TO_POOL_STAGE_IDS
      ?? process.env.BITRIX24_FILTER_STAGE_ID
      ?? "C36:NEW",
  );
  if (returnIds.has(stageId) || normalized.includes("bolsao") || normalized.includes("retorn")) return "retornaram";
  if (status === "perdida") return "perdidos";
  return "andamento";
}

export function classifyCapturaSistema(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
  snapshot?: SystemCaptureSnapshot,
): Exclude<ResultadoBucket, "total" | "quarentena"> {
  if (snapshot) {
    if (isSignedContractSnapshot(snapshot)) return "vendas";
    if (snapshot.stageSemantic.toUpperCase() === "F") return "perdidos";
  } else if (status === "convertida") {
    return "vendas";
  }

  return classifyLocal(status, stage, stageId);
}

export function isQuarentenaComercialGeral(snapshot: SystemCaptureSnapshot | undefined, comercialCategoryId: string) {
  return Boolean(
    snapshot
    && snapshot.categoryId === comercialCategoryId
    && isQuarantineSnapshot(snapshot),
  );
}

export function bucketForSystemCapture(
  status: StatusOportunidade,
  stage: string,
  stageId: string,
  snapshot: SystemCaptureSnapshot | undefined,
  comercialCategoryId: string,
): Exclude<ResultadoBucket, "total"> {
  if (isQuarentenaComercialGeral(snapshot, comercialCategoryId)) return "quarentena";
  return classifyCapturaSistema(status, stage, stageId, snapshot);
}
