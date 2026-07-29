import { describe, expect, it } from "vitest";
import { geofenceSettingsSchema } from "./geofence-settings";

describe("geofence settings schema", () => {
  it("accepts coordinates and a radius from form strings", () => {
    expect(geofenceSettingsSchema.parse({
      latitude: "-8.2833",
      longitude: "-34.9500",
      radiusMeters: "150",
    })).toEqual({
      latitude: -8.2833,
      longitude: -34.95,
      radiusMeters: 150,
    });
  });

  it("rejects out-of-range coordinates and radius", () => {
    expect(geofenceSettingsSchema.safeParse({
      latitude: 91,
      longitude: -181,
      radiusMeters: 5,
    }).success).toBe(false);
  });
});
