import { describe, expect, it } from "vitest";
import {
  buildConfirmedSystemCaptureIds,
  filterCapturasConfirmadasDoSistema,
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

  it("confirma capturas apenas quando o livro diário registra a quantidade", () => {
    const opportunities = [
      { id: "a", corretor_id: "c1", captada_em: "2026-03-10T10:00:00.000Z" },
      { id: "b", corretor_id: "c1", captada_em: "2026-03-10T11:00:00.000Z" },
      { id: "c", corretor_id: "c1", captada_em: "2026-03-11T09:00:00.000Z" },
    ];

    expect(buildConfirmedSystemCaptureIds(opportunities, [
      { corretor_id: "c1", data: "2026-03-10", quantidade_captada: 1 },
    ])).toEqual(new Set(["a"]));

    expect(buildConfirmedSystemCaptureIds(opportunities, [])).toEqual(new Set());
  });

  it("filtra apenas capturas confirmadas no livro diário", () => {
    const { capturaRoletaIds, comercialGeralRoletaIds } = partitionRoletas([bolsaoRoleta, comercialRoleta]);
    const opportunities = [
      {
        id: "a",
        corretor_id: "c1",
        captada_em: "2026-03-10T10:00:00.000Z",
        data_criacao_bitrix: "2026-03-08T12:00:00.000Z",
        roleta_id: "bolsao-1",
      },
      {
        id: "b",
        corretor_id: "c1",
        captada_em: "2026-03-10T11:00:00.000Z",
        data_criacao_bitrix: "2026-03-08T12:00:00.000Z",
        roleta_id: "bolsao-1",
      },
    ];

    expect(filterCapturasConfirmadasDoSistema(
      opportunities,
      capturaRoletaIds,
      comercialGeralRoletaIds,
      [{ corretor_id: "c1", data: "2026-03-10", quantidade_captada: 1 }],
    ).map((item) => item.id)).toEqual(["a"]);
  });
});
