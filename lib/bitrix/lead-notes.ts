import "server-only";

import { bitrixCall } from "@/lib/bitrix/client";

const DEFAULT_NOTE_FIELD = "UF_CRM_1785940762251";

export function getBitrixLeadNoteField() {
  return process.env.BITRIX24_OBSERVACAO_AUDITORIA_FIELD ?? DEFAULT_NOTE_FIELD;
}

export async function updateDealLeadershipNote(dealId: string, note: string) {
  const normalizedDealId = dealId.trim();
  if (!normalizedDealId) {
    throw new Error("Negócio Bitrix inválido para observação da liderança.");
  }

  const noteField = getBitrixLeadNoteField();
  await bitrixCall<boolean>("crm.deal.update", new URLSearchParams({
    id: normalizedDealId,
    [`fields[${noteField}]`]: note,
  }));
}
