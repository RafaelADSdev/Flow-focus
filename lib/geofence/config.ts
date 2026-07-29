export type OfficeGeofenceConfig = {
  office: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
};

export type GeoSessionConfig = {
  sessionSeconds: number;
  signingSecret: string;
};

export type GeofenceConfig = OfficeGeofenceConfig & GeoSessionConfig;

export class GeofenceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeofenceConfigError";
  }
}

function requiredCoordinate(name: "OFFICE_LAT" | "OFFICE_LNG", minimum: number, maximum: number) {
  const rawValue = process.env[name];
  const value = rawValue === undefined ? Number.NaN : Number(rawValue);

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new GeofenceConfigError(`${name} deve ser uma coordenada entre ${minimum} e ${maximum}.`);
  }

  return value;
}

function positiveInteger(name: "OFFICE_RADIUS_METERS" | "GEO_SESSION_SECONDS", fallback: number) {
  const rawValue = process.env[name];
  const value = rawValue === undefined || rawValue.trim() === "" ? fallback : Number(rawValue);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GeofenceConfigError(`${name} deve ser um n\u00famero inteiro positivo.`);
  }

  return value;
}

function signingSecret() {
  const value = process.env.GEO_SESSION_SECRET
    ?? process.env.SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value || value.length < 32) {
    throw new GeofenceConfigError(
      "Configure GEO_SESSION_SECRET com pelo menos 32 caracteres (ou uma chave secreta do Supabase no servidor).",
    );
  }

  return value;
}

export function getEnvironmentOfficeConfig(): OfficeGeofenceConfig {
  return {
    office: {
      latitude: requiredCoordinate("OFFICE_LAT", -90, 90),
      longitude: requiredCoordinate("OFFICE_LNG", -180, 180),
    },
    radiusMeters: positiveInteger("OFFICE_RADIUS_METERS", 150),
  };
}

export function getGeoSessionConfig(): GeoSessionConfig {
  const sessionSeconds = positiveInteger("GEO_SESSION_SECONDS", 30);

  if (sessionSeconds < 10 || sessionSeconds > 300) {
    throw new GeofenceConfigError("GEO_SESSION_SECONDS deve ficar entre 10 e 300 segundos.");
  }

  return {
    sessionSeconds,
    signingSecret: signingSecret(),
  };
}

export function getGeofenceConfig(): GeofenceConfig {
  return { ...getEnvironmentOfficeConfig(), ...getGeoSessionConfig() };
}

export function geoRenewalIntervalMs(sessionSeconds: number) {
  return Math.max(3_000, Math.min(15_000, Math.floor(sessionSeconds * 500)));
}
