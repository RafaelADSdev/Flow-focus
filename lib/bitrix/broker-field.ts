import "server-only";

const DEFAULT_BROKER_FIELD = "UF_CRM_1726664928";

export function getBitrixBrokerField() {
  return process.env.BITRIX24_CORRETOR_FIELD ?? DEFAULT_BROKER_FIELD;
}

export function toBitrixItemField(fieldName: string) {
  if (fieldName.startsWith("UF_CRM_")) {
    return `ufCrm_${fieldName.slice("UF_CRM_".length)}`;
  }
  return fieldName;
}
