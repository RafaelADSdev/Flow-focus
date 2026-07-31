import { describe, expect, it } from "vitest";
import { availableCaptureSlots, MAX_ACTIVE_LEADS } from "./capture-capacity";

describe("capacidade dinâmica de captação", () => {
  it("libera uma vaga para cada lead aprovado", () => {
    expect(availableCaptureSlots(6)).toBe(0);
    expect(availableCaptureSlots(2)).toBe(4);
    expect(availableCaptureSlots(0)).toBe(6);
  });

  it("nunca libera acima do teto ou com valores inválidos", () => {
    expect(MAX_ACTIVE_LEADS).toBe(6);
    expect(availableCaptureSlots(9)).toBe(0);
    expect(availableCaptureSlots(-2)).toBe(6);
    expect(availableCaptureSlots(Number.NaN)).toBe(0);
  });
});
