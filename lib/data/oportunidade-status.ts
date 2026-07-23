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

export function mapOportunidadeStatus(
  oportunidade: OportunidadeStatusInput,
): "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida" {
  if ("status" in oportunidade && oportunidade.status) {
    return oportunidade.status as "disponivel" | "captada" | "em_trabalho" | "convertida" | "perdida";
  }

  if (!oportunidade.corretor_id) return "disponivel";

  const stage = String(oportunidade.bitrix_stage_id ?? "").toUpperCase();
  if (stage.includes("WON") || stage.includes("CONVERT")) return "convertida";
  if (stage.includes("LOSE") || stage.includes("LOST") || stage.includes("PERD")) return "perdida";
  if (oportunidade.ultima_atualizacao_bitrix && oportunidade.captada_em) return "em_trabalho";
  return "captada";
}
