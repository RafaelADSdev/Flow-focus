function isLostStageName(name: string) {
  return /perdid|prazo/i.test(name);
}

const STAGE_PALETTE = [
  "oklch(0.58 0.12 285)",
  "oklch(0.60 0.11 255)",
  "oklch(0.62 0.10 230)",
  "oklch(0.64 0.09 205)",
  "oklch(0.62 0.10 175)",
  "oklch(0.60 0.09 155)",
  "oklch(0.58 0.08 95)",
  "oklch(0.56 0.10 70)",
] as const;

export function stageBarColor(name: string, index: number) {
  if (isLostStageName(name)) return "oklch(0.56 0.19 28)";
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("tentativa")) return STAGE_PALETTE[0];
  if (normalized.includes("novo")) return STAGE_PALETTE[1];
  if (normalized.includes("agendad")) return STAGE_PALETTE[2];
  if (normalized.includes("realizad")) return STAGE_PALETTE[3];
  if (normalized.includes("andamento") || normalized.includes("atendimento")) return STAGE_PALETTE[4];
  if (normalized.includes("proposta")) return STAGE_PALETTE[5];
  if (normalized.includes("assinad") || normalized.includes("ganh")) return "oklch(0.55 0.13 155)";
  return STAGE_PALETTE[index % STAGE_PALETTE.length];
}
