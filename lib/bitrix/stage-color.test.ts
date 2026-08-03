import { describe, expect, it } from "vitest";
import { normalizeBitrixStageColor } from "@/lib/bitrix/stage-color";

describe("normalizeBitrixStageColor", () => {
  it("normaliza cores hexadecimais configuradas nas etapas do Bitrix", () => {
    expect(normalizeBitrixStageColor(" #3bc8f5 ")).toBe("#3BC8F5");
  });

  it("descarta valores que não podem ser usados com segurança no CSS", () => {
    expect(normalizeBitrixStageColor("var(--danger)")).toBeNull();
    expect(normalizeBitrixStageColor("#fff")).toBeNull();
    expect(normalizeBitrixStageColor(null)).toBeNull();
  });
});
