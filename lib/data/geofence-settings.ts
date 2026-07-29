import "server-only";

import {
  GeofenceConfigError,
  getEnvironmentOfficeConfig,
  getGeoSessionConfig,
  type GeofenceConfig,
} from "@/lib/geofence/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import type { GeofenceSettingsData } from "@/lib/types/geofence-settings";

type GeofenceRow = {
  latitude: number;
  longitude: number;
  raio_metros: number;
  atualizado_por: string;
  atualizado_em: string;
};

class MissingGeofenceSettingsTableError extends Error {
  constructor() {
    super("Missing geofence settings table");
    this.name = "MissingGeofenceSettingsTableError";
  }
}

function isMissingSettingsTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01"
    || error?.code === "PGRST205";
}

async function loadDatabaseSettings(): Promise<GeofenceRow | null> {
  if (!hasSupabaseSecretKey()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("geofence_configuracao")
    .select("latitude, longitude, raio_metros, atualizado_por, atualizado_em")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) throw new MissingGeofenceSettingsTableError();
    throw new GeofenceConfigError(`Falha ao carregar a configura\u00e7\u00e3o de localiza\u00e7\u00e3o: ${error.message}`);
  }

  return data;
}

export async function getActiveGeofenceConfig(): Promise<GeofenceConfig> {
  const session = getGeoSessionConfig();
  let stored: GeofenceRow | null;

  try {
    stored = await loadDatabaseSettings();
  } catch (error) {
    if (error instanceof MissingGeofenceSettingsTableError) {
      return { ...getEnvironmentOfficeConfig(), ...session };
    }
    throw error;
  }

  if (stored) {
    return {
      office: { latitude: stored.latitude, longitude: stored.longitude },
      radiusMeters: stored.raio_metros,
      ...session,
    };
  }

  return { ...getEnvironmentOfficeConfig(), ...session };
}

function environmentFallback(loadError: string | null, canSave: boolean): GeofenceSettingsData {
  try {
    const fallback = getEnvironmentOfficeConfig();
    return {
      latitude: fallback.office.latitude,
      longitude: fallback.office.longitude,
      radiusMeters: fallback.radiusMeters,
      source: "environment",
      updatedAt: null,
      updatedBy: null,
      loadError,
      canSave,
    };
  } catch {
    return {
      latitude: null,
      longitude: null,
      radiusMeters: 150,
      source: "unconfigured",
      updatedAt: null,
      updatedBy: null,
      loadError,
      canSave,
    };
  }
}

export async function getGeofenceSettingsData(): Promise<GeofenceSettingsData> {
  if (!hasSupabaseSecretKey()) {
    return environmentFallback(
      "A chave secreta do Supabase precisa estar configurada para salvar o per\u00edmetro.",
      false,
    );
  }

  try {
    const stored = await loadDatabaseSettings();
    if (!stored) {
      return environmentFallback(
        "Ainda n\u00e3o h\u00e1 um per\u00edmetro salvo. Enquanto isso, o servidor usa as vari\u00e1veis de ambiente.",
        true,
      );
    }

    const admin = createAdminClient();
    const { data: actor } = await admin
      .from("usuarios")
      .select("nome")
      .eq("id", stored.atualizado_por)
      .maybeSingle();

    return {
      latitude: stored.latitude,
      longitude: stored.longitude,
      radiusMeters: stored.raio_metros,
      source: "database",
      updatedAt: stored.atualizado_em,
      updatedBy: actor?.nome ?? "Autor indispon\u00edvel",
      loadError: null,
      canSave: true,
    };
  } catch (error) {
    if (error instanceof MissingGeofenceSettingsTableError) {
      return environmentFallback(
        "A migration da configura\u00e7\u00e3o de localiza\u00e7\u00e3o ainda n\u00e3o foi aplicada no Supabase.",
        false,
      );
    }

    console.error("Falha ao carregar a configuracao de geofence:", error);
    return environmentFallback(
      "N\u00e3o foi poss\u00edvel confirmar o per\u00edmetro salvo. Recarregue a p\u00e1gina antes de tentar alterar.",
      false,
    );
  }
}
