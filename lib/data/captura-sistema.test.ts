import { describe, expect, it } from "vitest";
import {
  isCapturaDoSistema,
  isCapturaImportadaComercialGeral,
  partitionRoletas,
} from "@/lib/data/captura-sistema";

describe("captura-sistema", () => {
  const bolsaoRoleta = {
    id: "bolsao-1",
    nome: "Focus Bolsão",
    bitrix_funil_id: "36:C36:NEW:focus-bolsao",
    bitrix_category_id: "36",
  };
  const comercialRoleta = {
    id: "cg-1",
    nome: "Comercial Geral · Focus",
    bitrix_funil_id: "16:*:focus:dashboard",
    bitrix_category_id: "16",
  };

  it("separa roletas de captação do Comercial Geral", () => {
    const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas([bolsaoRoleta, comercialRoleta]);
    expect([...capturaRoletaIds]).toEqual(["bolsao-1"]);
    expect([...comercialGeralRoletaIds]).toEqual(["cg-1"]);
  });

  it("detecta captada_em sintética do sync do Comercial Geral", () => {
    const created = "2026-03-10T12:00:00.000Z";
    expect(isCapturaImportadaComercialGeral(created, created)).toBe(true);
    expect(isCapturaImportadaComercialGeral("2026-03-12T15:30:00.000Z", created)).toBe(false);
  });

  it("aceita apenas capturas reais do bolsão", () => {
    const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas([bolsaoRoleta, comercialRoleta]);
    expect(isCapturaDoSistema({
      captada_em: "2026-03-12T15:30:00.000Z",
      data_criacao_bitrix: "2026-03-10T12:00:00.000Z",
      roleta_id: "bolsao-1",
    }, capturaRoletaIds, comercialGeralRoletaIds)).toBe(true);

    expect(isCapturaDoSistema({
      captada_em: "2026-03-10T12:00:00.000Z",
      data_criacao_bitrix: "2026-03-10T12:00:00.000Z",
      roleta_id: "bolsao-1",
    }, capturaRoletaIds, comercialGeralRoletaIds)).toBe(false);

    expect(isCapturaDoSistema({
      captada_em: "2026-03-12T15:30:00.000Z",
      data_criacao_bitrix: "2026-03-10T12:00:00.000Z",
      roleta_id: "cg-1",
    }, capturaRoletaIds, comercialGeralRoletaIds)).toBe(false);
  });
});
