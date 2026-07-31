import "server-only";

import { mapLimit } from "@/lib/bitrix/cache";
import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";

type BitrixUserPhoto = {
  ID?: string;
  PERSONAL_PHOTO?: string;
};

export async function fetchBitrixUserPhotos(bitrixUserIds: string[]) {
  const photos = new Map<string, string>();
  if (!hasBitrixEnv()) return photos;

  const uniqueIds = [...new Set(bitrixUserIds.map((id) => id.trim()).filter(Boolean))];
  await mapLimit(uniqueIds, 4, async (bitrixUserId) => {
    try {
      const page = await bitrixCallPage<BitrixUserPhoto[]>(
        "user.get",
        new URLSearchParams({ "FILTER[ID]": bitrixUserId }),
      );
      const photo = String(page.result[0]?.PERSONAL_PHOTO ?? "").trim();
      if (photo) photos.set(bitrixUserId, photo);
    } catch {
      // Uma falha pontual no Bitrix24 não interrompe o ranking.
    }
  });

  return photos;
}
