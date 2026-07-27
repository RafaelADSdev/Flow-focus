import "server-only";

type OportunidadeStatusInput = {
  corretor_id: string | null;
  captada_em: string | null;
  ultima_atualizacao_bitrix?: string | null;
  bitrix_stage_id?: string | null;
  status?: string | null;
};

export function isOportunidadeDisponivel(oportunidade: Pick<OportunidadeStatusInput, "corretor_id" | "captada_em" | "status">) {
  if ("status" in oportunidade && oportunidade.status) {
    return oportunidade.status === "disponivel";
  }
  return oportunidade.corretor_id === null && oportunidade.captada_em === null;
}

function semanticFromStage(stage: string) {
  const match = stage.match(/#([A-Z])\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

export function mapOportunidadeStatus(
  oportunidade: OportunidadeStatusInput,
): "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida" {
  if ("status" in oportunidade && oportunidade.status) {
    return oportunidade.status as "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida";
  }

  const stage = String(oportunidade.bitrix_stage_id ?? "").toUpperCase();
  const semantic = semanticFromStage(stage);

  if (semantic === "S" || stage.includes("WON") || stage.includes("CONVERT")) return "convertida";
  if (semantic === "F" || stage.includes("LOSE") || stage.includes("LOST") || stage.includes("PERD")) {
    return "perdida";
  }
  if (semantic === "P") return "em_trabalho";

  if (!oportunidade.corretor_id) return "disponivel";
  if (oportunidade.ultima_atualizacao_bitrix && oportunidade.captada_em) return "em_trabalho";
  return "captada";
}
