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

export type CapturaDiariaRef = {
  corretor_id: string;
  data: string;
  quantidade_captada: number;
};

/** Confirma capturas pelo livro diário — mesma regra da migration de reconciliação do legado. */
export function buildConfirmedSystemCaptureIds<T extends {
  id: string;
  corretor_id: string | null;
  captada_em: string | null;
}>(opportunities: T[], capturasDiarias: CapturaDiariaRef[]) {
  const limitByBrokerDate = new Map<string, number>();
  for (const row of capturasDiarias) {
    limitByBrokerDate.set(`${row.corretor_id}:${row.data}`, row.quantidade_captada);
  }

  const groups = new Map<string, Array<{ id: string; captada_em: string }>>();
  for (const opportunity of opportunities) {
    if (!opportunity.corretor_id || !opportunity.captada_em) continue;
    const dataCaptura = opportunity.captada_em.slice(0, 10);
    const key = `${opportunity.corretor_id}:${dataCaptura}`;
    const group = groups.get(key) ?? [];
    group.push({ id: opportunity.id, captada_em: opportunity.captada_em });
    groups.set(key, group);
  }

  const confirmed = new Set<string>();
  for (const [key, group] of groups) {
    const limit = limitByBrokerDate.get(key) ?? 0;
    if (limit <= 0) continue;
    group
      .sort((a, b) => a.captada_em.localeCompare(b.captada_em) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .forEach((item) => confirmed.add(item.id));
  }

  return confirmed;
}

export function filterCapturasConfirmadasDoSistema<T extends {
  id: string;
  corretor_id: string | null;
  captada_em: string | null;
  data_criacao_bitrix: string | null;
  roleta_id: string;
}>(
  opportunities: T[],
  capturaRoletaIds: Set<string>,
  comercialGeralRoletaIds: Set<string>,
  capturasDiarias: CapturaDiariaRef[],
) {
  const systemCaptures = opportunities.filter((item) => (
    isCapturaDoSistema(item, capturaRoletaIds, comercialGeralRoletaIds)
  ));
  const confirmedIds = buildConfirmedSystemCaptureIds(systemCaptures, capturasDiarias);
  return systemCaptures.filter((item) => confirmedIds.has(item.id));
}
