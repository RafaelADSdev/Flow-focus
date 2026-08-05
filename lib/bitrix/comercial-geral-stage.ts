type BitrixDealStageFields = {
  STAGE_ID?: unknown;
  STAGE_SEMANTIC_ID?: unknown;
};

function normalizeStageId(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Lost deals are not part of the Comercial Geral historical load. */
export function isComercialGeralLostStage(
  deal: BitrixDealStageFields,
  categoryId: string,
) {
  const stageId = normalizeStageId(deal.STAGE_ID);
  const [baseStageId, inlineSemantic] = stageId.split("#", 2);
  const semantic = String(deal.STAGE_SEMANTIC_ID ?? inlineSemantic ?? "").trim().toUpperCase();
  const defaultLostStageId = normalizeStageId(`C${categoryId}:LOSE`);

  return semantic === "F"
    || baseStageId === defaultLostStageId
    || /:(?:LOSE|LOST|PERDID(?:O|A|OS|AS)?)$/.test(baseStageId);
}
