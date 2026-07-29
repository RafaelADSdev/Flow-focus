import { describe, expect, it } from "vitest";
import { buildBolsaoRoletaRow, canonicalRoletaAtualValue, slugRoletaAtual } from "./bolsao-roleta";

const config = {
  categoryId: "36",
  stageId: "C36:NEW",
  rouletteTag: "Focus",
};

describe("bolsao-roleta", () => {
  it("gera slug estável para valores de Roleta Atual", () => {
    expect(slugRoletaAtual("Focus Lançamentos")).toBe("focus-lancamentos");
    expect(slugRoletaAtual("  Focus Bolsão  ")).toBe("focus-bolsao");
  });

  it("cria linhas distintas para roletas X e Y", () => {
    const roletaX = buildBolsaoRoletaRow("Focus Lançamentos", config);
    const roletaY = buildBolsaoRoletaRow("Focus Bolsão", config);

    expect(roletaX.bitrix_funil_id).not.toBe(roletaY.bitrix_funil_id);
    expect(roletaX.nome).toBe("Focus Lançamentos");
    expect(roletaY.nome).toBe("Focus Bolsão");
    expect(roletaX.bitrix_category_id).toBe("36");
    expect(roletaY.bitrix_roleta_valor).toBe(canonicalRoletaAtualValue("Focus Bolsão"));
  });

  it("unifica variantes de caixa e acento na chave canônica", () => {
    const upper = canonicalRoletaAtualValue("Ária Boa Vista | CME | Focus");
    const lower = canonicalRoletaAtualValue("aria boa vista | cme | focus");
    expect(upper).toBe(lower);
    expect(buildBolsaoRoletaRow("Ária Boa Vista | CME | Focus", config).bitrix_roleta_valor).toBe(upper);
  });

  it("usa tag Focus quando Roleta Atual está vazia", () => {
    const row = buildBolsaoRoletaRow("", config);
    expect(row.nome).toBe("Focus");
    expect(row.bitrix_roleta_valor).toBe("focus");
    expect(row.bitrix_funil_id).toBe("36:C36:NEW:focus");
  });
});
