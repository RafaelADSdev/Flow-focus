const MIN_PASSWORD_LENGTH = 6;

export function passwordFromBitrixId(bitrixUserId: string) {
  const normalized = bitrixUserId.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("ID do Bitrix inválido.");
  }
  return normalized.padStart(MIN_PASSWORD_LENGTH, "0");
}
