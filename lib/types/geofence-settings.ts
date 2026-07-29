export type GeofenceSettingsSource = "database" | "environment" | "unconfigured";

export type GeofenceSettingsData = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  source: GeofenceSettingsSource;
  updatedAt: string | null;
  updatedBy: string | null;
  loadError: string | null;
  canSave: boolean;
};
