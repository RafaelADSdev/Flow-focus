import "server-only";

import { getBitrixBrokerField } from "@/lib/bitrix/broker-field";
import { bitrixCall, bitrixCallJson } from "@/lib/bitrix/client";
import { getBitrixCaptureTarget } from "@/lib/bitrix/capture-target";

export type AssignDealResult = {
  assignedById: string;
  categoryId: string;
  stageId: string;
};

export async function assignDealToCorretor(bitrixDealId: string, bitrixUserId: string): Promise<AssignDealResult> {
  const normalizedDealId = bitrixDealId.trim();
  const normalizedUserId = bitrixUserId.trim();

  if (!normalizedDealId || !normalizedUserId) {
    throw new Error("Negócio ou corretor Bitrix inválido para atribuição.");
  }

  const { categoryId, stageId } = getBitrixCaptureTarget();
  const brokerField = getBitrixBrokerField();

  // 1) Troca responsável e corretor ainda no funil de origem (Encaminhamento de leads).
  await bitrixCall<boolean>("crm.deal.update", new URLSearchParams({
    id: normalizedDealId,
    "fields[ASSIGNED_BY_ID]": normalizedUserId,
    [`fields[${brokerField}]`]: normalizedUserId,
  }));

  // 2) Só então move para Comercial Geral · Tentativa de Contato.
  await bitrixCallJson("crm.item.update", {
    entityTypeId: 2,
    id: Number(normalizedDealId),
    fields: {
      categoryId: Number(categoryId),
      stageId,
    },
  });

  return {
    assignedById: normalizedUserId,
    categoryId,
    stageId,
  };
}
