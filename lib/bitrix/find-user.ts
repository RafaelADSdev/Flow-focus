import "server-only";

import { bitrixCall } from "@/lib/bitrix/client";

export type BitrixUserRecord = {
  ID?: unknown;
  EMAIL?: unknown;
  NAME?: unknown;
  SECOND_NAME?: unknown;
  LAST_NAME?: unknown;
  PERSONAL_PHOTO?: unknown;
};

export async function findBitrixUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLocaleLowerCase();
  if (!normalizedEmail) return null;

  const users = await bitrixCall<BitrixUserRecord[]>("user.get", new URLSearchParams({
    "FILTER[EMAIL]": normalizedEmail,
    "FILTER[ACTIVE]": "true",
  }));

  return users.find((user) => (
    String(user.EMAIL ?? "").trim().toLocaleLowerCase() === normalizedEmail
  )) ?? null;
}

export async function findBitrixUserById(bitrixUserId: string) {
  const normalizedId = bitrixUserId.trim();
  if (!normalizedId) return null;

  const users = await bitrixCall<BitrixUserRecord[]>("user.get", new URLSearchParams({
    "FILTER[ID]": normalizedId,
    "FILTER[ACTIVE]": "true",
  }));

  return users.find((user) => String(user.ID ?? "").trim() === normalizedId) ?? null;
}
