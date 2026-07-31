import { ROLETA_COMERCIAL_GERAL_FOCUS, isRoletaCaptura } from "@/lib/data/roleta-captura";

const COMERCIAL_CATEGORY_ID = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";

type RoletaRef = {
  id: string;
  nome: string;
  bitrix_funil_id?: string | null;
  bitrix_category_id?: string | null;
};

export function isRoletaComercialGeral(roleta: Omit<RoletaRef, "id">) {
  if (roleta.nome === ROLETA_COMERCIAL_GERAL_FOCUS) return true;
  if (roleta.bitrix_funil_id?.endsWith(":dashboard")) return true;
  return roleta.bitrix_category_id === COMERCIAL_CATEGORY_ID && !isRoletaCaptura(roleta);
}

export function partitionRoletas(roletas: RoletaRef[]) {
  const capturaRoletaIds = new Set<string>();
  const comercialGeralRoletaIds = new Set<string>();

  for (const roleta of roletas) {
    if (isRoletaCaptura(roleta)) {
      capturaRoletaIds.add(roleta.id);
      continue;
    }
    if (isRoletaComercialGeral(roleta)) {
      comercialGeralRoletaIds.add(roleta.id);
    }
  }

  return { capturaRoletaIds, comercialGeralRoletaIds };
}

/** O sync do Comercial Geral preenche captada_em com DATE_CREATE quando o negócio não foi capturado no Flow Focus. */
export function isCapturaImportadaComercialGeral(
  captadaEm: string | null,
  dataCriacaoBitrix: string | null,
) {
  if (!captadaEm || !dataCriacaoBitrix) return false;
  const captura = Date.parse(captadaEm);
  const criacao = Date.parse(dataCriacaoBitrix);
  if (Number.isNaN(captura) || Number.isNaN(criacao)) return false;
  return Math.abs(captura - criacao) < 5_000;
}

export function isCapturaDoSistema(
  opportunity: {
    captada_em: string | null;
    data_criacao_bitrix: string | null;
    roleta_id: string;
  },
  capturaRoletaIds: Set<string>,
  comercialGeralRoletaIds: Set<string>,
) {
  if (!opportunity.captada_em || !capturaRoletaIds.has(opportunity.roleta_id)) return false;
  if (comercialGeralRoletaIds.has(opportunity.roleta_id)) return false;
  if (isCapturaImportadaComercialGeral(opportunity.captada_em, opportunity.data_criacao_bitrix)) return false;
  return true;
}
