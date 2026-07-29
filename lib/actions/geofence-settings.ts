"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth/require-admin";
import { expiredGeoCookieOptions, GEO_SESSION_COOKIE } from "@/lib/geofence/session";
import { geofenceSettingsSchema } from "@/lib/schemas/geofence-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

type GeofenceSettingsActionResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

function isMissingSettingsTable(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function salvarConfiguracaoGeofence(input: unknown): Promise<GeofenceSettingsActionResult> {
  const actor = await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return {
      ok: false,
      error: "A chave secreta do Supabase precisa estar configurada no servidor.",
    };
  }

  const parsed = geofenceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revise os campos do per\u00edmetro.",
    };
  }

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("geofence_configuracao")
    .select("latitude, longitude, raio_metros")
    .eq("id", 1)
    .maybeSingle();

  if (currentError) {
    if (isMissingSettingsTable(currentError)) {
      return {
        ok: false,
        error: "A migration da configura\u00e7\u00e3o de localiza\u00e7\u00e3o ainda n\u00e3o foi aplicada no Supabase.",
      };
    }

    console.error("Falha ao conferir a configuracao atual de geofence:", currentError);
    return {
      ok: false,
      error: "N\u00e3o foi poss\u00edvel confirmar o per\u00edmetro atual. Recarregue a p\u00e1gina e tente novamente.",
    };
  }

  if (
    current
    && current.latitude === parsed.data.latitude
    && current.longitude === parsed.data.longitude
    && current.raio_metros === parsed.data.radiusMeters
  ) {
    return {
      ok: false,
      error: "Nenhuma altera\u00e7\u00e3o foi feita no per\u00edmetro.",
    };
  }

  const { data, error } = await admin
    .from("geofence_configuracao")
    .upsert({
      id: 1,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      raio_metros: parsed.data.radiusMeters,
      atualizado_por: actor.id,
    }, { onConflict: "id" })
    .select("atualizado_em")
    .single();

  if (error) {
    if (isMissingSettingsTable(error)) {
      return {
        ok: false,
        error: "A migration da configura\u00e7\u00e3o de localiza\u00e7\u00e3o ainda n\u00e3o foi aplicada no Supabase.",
      };
    }

    console.error("Falha ao salvar a configuracao de geofence:", error);
    return {
      ok: false,
      error: "N\u00e3o foi poss\u00edvel salvar o per\u00edmetro. Recarregue a p\u00e1gina e tente novamente.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(GEO_SESSION_COOKIE, "", expiredGeoCookieOptions);
  revalidatePath("/configuracoes");
  revalidatePath("/configuracoes/localizacao");

  return { ok: true, updatedAt: data.atualizado_em };
}
