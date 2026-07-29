import { describe, expect, it } from "vitest";
import { haversineDistanceMeters, isValidGeographicPoint } from "./distance";
import {
  isGeofenceProtectedApi,
  isGeofenceProtectedPage,
  sanitizeGeofenceReturnPath,
} from "./routes";
import { createGeoSessionToken, isValidGeoSessionToken } from "./session";

const SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
const USER_ID = "0d5114f4-5502-4415-9251-0f75905694d7";

describe("distancia de geofence", () => {
  it("retorna zero para o mesmo ponto", () => {
    const office = { latitude: -8.2833, longitude: -34.95 };
    expect(haversineDistanceMeters(office, office)).toBe(0);
  });

  it("calcula aproximadamente um grau no Equador", () => {
    const distance = haversineDistanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );

    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(112_000);
  });

  it("rejeita coordenadas fora do intervalo geografico", () => {
    expect(isValidGeographicPoint({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidGeographicPoint({ latitude: 0, longitude: -181 })).toBe(false);
  });
});

describe("geo-sessao assinada", () => {
  it("aceita um token integro, vigente e vinculado ao usuario", async () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const session = await createGeoSessionToken(USER_ID, 30, SECRET, now);

    await expect(isValidGeoSessionToken(session.token, USER_ID, SECRET, now + 29_000)).resolves.toBe(true);
  });

  it("rejeita token expirado, adulterado ou copiado para outro usuario", async () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const session = await createGeoSessionToken(USER_ID, 30, SECRET, now);
    const tampered = `${session.token.slice(0, -1)}${session.token.endsWith("a") ? "b" : "a"}`;

    await expect(isValidGeoSessionToken(session.token, USER_ID, SECRET, now + 30_000)).resolves.toBe(false);
    await expect(isValidGeoSessionToken(tampered, USER_ID, SECRET, now)).resolves.toBe(false);
    await expect(isValidGeoSessionToken(session.token, "outro-usuario", SECRET, now)).resolves.toBe(false);
  });
});

describe("escopo de rotas do geofence", () => {
  it("protege paginas operacionais e o namespace de dados", () => {
    expect(isGeofenceProtectedPage("/corretor")).toBe(true);
    expect(isGeofenceProtectedPage("/configuracoes/acesso")).toBe(true);
    expect(isGeofenceProtectedPage("/configuracoes")).toBe(false);
    expect(isGeofenceProtectedPage("/configuracoes/localizacao")).toBe(false);
    expect(isGeofenceProtectedApi("/api/dados/carteira")).toBe(true);
    expect(isGeofenceProtectedApi("/api/verificar-localizacao")).toBe(false);
  });

  it("aceita apenas retornos internos para paginas protegidas", () => {
    expect(sanitizeGeofenceReturnPath("/equipe?mes=2026-07")).toBe("/equipe?mes=2026-07");
    expect(sanitizeGeofenceReturnPath("https://example.com")).toBe("/corretor");
    expect(sanitizeGeofenceReturnPath("//example.com/equipe")).toBe("/corretor");
    expect(sanitizeGeofenceReturnPath("/login")).toBe("/corretor");
  });
});
