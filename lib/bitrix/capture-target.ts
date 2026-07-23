import "server-only";

export type BitrixCaptureTarget = {
  categoryId: string;
  stageId: string;
};

export function getBitrixCaptureTarget(): BitrixCaptureTarget {
  const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
  const stageId = process.env.BITRIX24_CAPTURE_STAGE_ID ?? "C16:UC_PZR1SI";
  return { categoryId, stageId };
}
