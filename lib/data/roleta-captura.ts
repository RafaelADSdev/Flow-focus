import { getBolsaoSyncDefaults } from "@/lib/bitrix/bolsao-roleta";

export const ROLETA_COMERCIAL_GERAL_FOCUS = "Comercial Geral · Focus";

export function isRoletaCaptura(roleta: {
  nome: string;
  bitrix_funil_id?: string | null;
  bitrix_category_id?: string | null;
}) {
  if (roleta.nome === ROLETA_COMERCIAL_GERAL_FOCUS) return false;
  if (roleta.bitrix_funil_id?.endsWith(":dashboard")) return false;
  const categoryId = getBolsaoSyncDefaults().categoryId;
  if (!roleta.bitrix_category_id || roleta.bitrix_category_id !== categoryId) return false;
  return true;
}
