function isLostStageName(name: string) {
  return /perdid|prazo/i.test(name);
}

/** Cores oficiais da esteira Comercial - GERAL no Bitrix24 (category 16). */
const COMERCIAL_GERAL_STAGE_COLORS: Array<{ match: RegExp; color: string }> = [
  { match: /novo/, color: "#003172" },
  { match: /tentativa/, color: "#FFF55A" },
  { match: /em atendimento|atend\./, color: "#00ADF2" },
  { match: /agendad/, color: "#074AA3" },
  { match: /realizad/, color: "#0856BD" },
  { match: /proposta/, color: "#00A99D" },
  { match: /rodad/, color: "#DBDDE0" },
  { match: /assinad|ganh/, color: "#7BD500" },
  { match: /prazo.*perdid|perdid.*prazo/, color: "#9F0037" },
  { match: /perdid/, color: "#FF5752" },
];

export function stageBarColor(name: string, index: number) {
  const normalized = name.trim().toLowerCase();
  if (isLostStageName(name)) {
    return normalized.includes("prazo") ? "#9F0037" : "#FF5752";
  }

  for (const entry of COMERCIAL_GERAL_STAGE_COLORS) {
    if (entry.match.test(normalized)) return entry.color;
  }

  const palette = [
    "#003172",
    "#FFF55A",
    "#00ADF2",
    "#074AA3",
    "#0856BD",
    "#00A99D",
    "#DBDDE0",
    "#7BD500",
  ] as const;
  return palette[index % palette.length];
}
