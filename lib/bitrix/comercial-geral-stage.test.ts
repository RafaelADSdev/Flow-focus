import { describe, expect, it } from "vitest";
import { isComercialGeralLostStage } from "@/lib/bitrix/comercial-geral-stage";

describe("isComercialGeralLostStage", () => {
  it("identifies C16:LOSE even when the value has spaces", () => {
    expect(isComercialGeralLostStage({ STAGE_ID: "C16: LOSE" }, "16")).toBe(true);
  });

  it("identifies any stage marked as lost by Bitrix", () => {
    expect(isComercialGeralLostStage({ STAGE_ID: "C16:OUTRO", STAGE_SEMANTIC_ID: "F" }, "16")).toBe(true);
  });

  it("identifies the semantic suffix persisted by the sync", () => {
    expect(isComercialGeralLostStage({ STAGE_ID: "C16:LOSE#F" }, "16")).toBe(true);
  });

  it("does not block active stages in the same category", () => {
    expect(isComercialGeralLostStage({ STAGE_ID: "C16:UC_PZR1SI", STAGE_SEMANTIC_ID: "P" }, "16")).toBe(false);
  });
});
