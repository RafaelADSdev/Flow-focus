export type BolsaoRoletaConfig = {
  categoryId: string;
  stageId: string;
  rouletteTag: string;
};

export function getBolsaoSyncDefaults(): BolsaoRoletaConfig {
  return {
    categoryId: process.env.BITRIX24_FILTER_CATEGORY_ID ?? "36",
    stageId: process.env.BITRIX24_FILTER_STAGE_ID ?? "C36:NEW",
    rouletteTag:
      process.env.BITRIX24_ROULETTE_TAG ?? process.env.BITRIX24_ROULETTE_SUFFIX ?? "Focus",
  };
}

export function canonicalRoletaAtualValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function slugRoletaAtual(value: string): string {
  const normalized = canonicalRoletaAtualValue(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 80) || "sem-roleta";
}

export function buildBolsaoRoletaRow(
  roletaAtual: string,
  config: BolsaoRoletaConfig,
) {
  const trimmed = roletaAtual.trim() || config.rouletteTag;
  const canonical = canonicalRoletaAtualValue(trimmed);
  const slug = slugRoletaAtual(trimmed);

  return {
    nome: trimmed,
    bitrix_funil_id: `${config.categoryId}:${config.stageId}:${slug}`,
    bitrix_category_id: config.categoryId,
    bitrix_roleta_valor: canonical,
    descricao: `Leads do bolsão (${config.stageId}) com Roleta Atual: ${trimmed}`,
    ativa: true,
  };
}
