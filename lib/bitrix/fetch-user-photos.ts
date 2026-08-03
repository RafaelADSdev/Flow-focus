import "server-only";

import { cached, invalidateCachePrefix, mapLimit } from "@/lib/bitrix/cache";
import { bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";

type BitrixUserPhoto = {
  ID?: string;
  PERSONAL_PHOTO?: string;
};

export async function fetchBitrixUserPhotos(
  bitrixUserIds: string[],
  options: { fresh?: boolean } = {},
) {
  const photos = new Map<string, string>();
  if (!hasBitrixEnv()) return photos;

  const uniqueIds = [...new Set(bitrixUserIds.map((id) => id.trim()).filter(Boolean))];
  await mapLimit(uniqueIds, 4, async (bitrixUserId) => {
    try {
      const cacheKey = `bitrix:user-photo:${bitrixUserId}`;
      if (options.fresh) invalidateCachePrefix(cacheKey);
      const photo = await cached(cacheKey, 10 * 60_000, async () => {
        const page = await bitrixCallPage<BitrixUserPhoto[]>(
          "user.get",
          new URLSearchParams({ "FILTER[ID]": bitrixUserId }),
        );
        return String(page.result[0]?.PERSONAL_PHOTO ?? "").trim() || null;
      });
      if (photo) photos.set(bitrixUserId, photo);
    } catch {
      // Uma falha pontual no Bitrix24 não interrompe o ranking.
    }
  });

  return photos;
}
