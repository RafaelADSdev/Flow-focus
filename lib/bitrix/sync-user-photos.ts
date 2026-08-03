import "server-only";

import { mapLimit } from "@/lib/bitrix/cache";
import { fetchBitrixUserPhotos } from "@/lib/bitrix/fetch-user-photos";
import { createAdminClient } from "@/lib/supabase/admin";

export type BitrixUserPhotoSyncSummary = {
  vinculados: number;
  encontrados: number;
  atualizados: number;
};

export async function syncBitrixUserPhotos(): Promise<BitrixUserPhotoSyncSummary> {
  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("usuarios")
    .select("id, bitrix_user_id, foto_url")
    .not("bitrix_user_id", "is", null);

  if (error) throw error;

  const linkedUsers = (users ?? []).filter(
    (user): user is typeof user & { bitrix_user_id: string } => Boolean(user.bitrix_user_id?.trim()),
  );
  const photos = await fetchBitrixUserPhotos(
    linkedUsers.map((user) => user.bitrix_user_id),
    { fresh: true },
  );
  const updates = linkedUsers.flatMap((user) => {
    const photoUrl = photos.get(user.bitrix_user_id) ?? null;
    if (!photoUrl || photoUrl === user.foto_url?.trim()) return [];
    return [{ id: user.id, photoUrl }];
  });

  await mapLimit(updates, 6, async ({ id, photoUrl }) => {
    const { error: updateError } = await admin
      .from("usuarios")
      .update({ foto_url: photoUrl })
      .eq("id", id);
    if (updateError) throw updateError;
  });

  return {
    vinculados: linkedUsers.length,
    encontrados: photos.size,
    atualizados: updates.length,
  };
}
