"use server";

import { revalidatePath } from "next/cache";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { refreshCapturedDealsForCorretores } from "@/lib/bitrix/refresh-captured-deals";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

export async function sincronizarResultadosBitrix() {
  if (!hasSupabaseSecretKey()) return { ok: false as const, error: "Sincronização indisponível no servidor." };
  const viewer = await getViewerContext();
  if (!viewer) return { ok: false as const, error: "Faça login novamente para sincronizar os resultados." };

  const admin = createAdminClient();
  let query = admin.from("usuarios").select("id, equipe_id").eq("ativo", true).eq("perfil", "corretor");
  if (viewer.perfil === "corretor") query = query.eq("id", viewer.userId);
  else if (viewer.perfil === "lider" && viewer.equipeId) query = query.eq("equipe_id", viewer.equipeId);
  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message };

  await refreshCapturedDealsForCorretores((data ?? []).map((item) => item.id));
  revalidatePath("/resultados");
  revalidatePath("/auditorias");
  revalidatePath("/corretor");
  return { ok: true as const, syncedAt: new Date().toISOString() };
}
