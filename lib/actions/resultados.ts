"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { canViewResultados } from "@/lib/auth/perfil";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { refreshCapturedDealsForCorretores } from "@/lib/bitrix/refresh-captured-deals";
import { syncBitrixPeople } from "@/lib/bitrix/sync-people";
import { syncBitrixUserPhotos } from "@/lib/bitrix/sync-user-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

export async function sincronizarResultadosBitrix() {
  if (!hasSupabaseSecretKey()) return { ok: false as const, error: "Sincronização indisponível no servidor." };
  const viewer = await getViewerContext();
  if (!viewer) return { ok: false as const, error: "Faça login novamente para sincronizar os resultados." };
  if (!canViewResultados(viewer.perfil)) {
    return { ok: false as const, error: "Acesso restrito a administração e diretoria." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("id, equipe_id")
    .eq("ativo", true)
    .eq("perfil", "corretor");
  if (error) return { ok: false as const, error: error.message };

  await Promise.all([
    refreshCapturedDealsForCorretores((data ?? []).map((item) => item.id)),
    syncBitrixUserPhotos(),
    hasBitrixEnv() ? syncBitrixPeople() : Promise.resolve(),
  ]);
  revalidatePath("/resultados");
  revalidatePath("/auditorias");
  revalidatePath("/corretor");
  revalidatePath("/equipe");
  revalidatePath("/configuracoes/acesso");
  return { ok: true as const, syncedAt: new Date().toISOString() };
}
