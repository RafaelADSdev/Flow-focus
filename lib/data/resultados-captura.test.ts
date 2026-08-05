import { describe, expect, it } from "vitest";
import type { SystemCaptureSnapshot } from "@/lib/data/resultados-captura";
import { isDateInResultadosRange } from "@/lib/resultados-filters";
import {
  bucketForSystemCapture,
  classifyCapturaSistema,
  isQuarentenaComercialGeral,
} from "@/lib/data/resultados-captura";

const COMERCIAL_CATEGORY = "16";

function snapshot(overrides: Partial<SystemCaptureSnapshot> = {}): SystemCaptureSnapshot {
  return {
    bitrixDealId: "100",
    titulo: "Lead teste",
    stageId: "C16:NEW",
    stageSemantic: "P",
    categoryId: COMERCIAL_CATEGORY,
    dateModify: "2026-08-05T10:00:00.000Z",
    dealStatus: null,
    ...overrides,
  };
}

describe("resultados-captura", () => {
  it("prioriza quarentena sobre andamento na classificação de captura do sistema", () => {
    const quarantineSnapshot = snapshot({ dealStatus: "4128" });

    expect(isQuarentenaComercialGeral(quarantineSnapshot, COMERCIAL_CATEGORY)).toBe(true);
    expect(bucketForSystemCapture("captada", "Em andamento", "C16:NEW", quarantineSnapshot, COMERCIAL_CATEGORY)).toBe("quarentena");
    expect(classifyCapturaSistema("captada", "Em andamento", "C16:NEW", quarantineSnapshot)).toBe("andamento");
  });

  it("classifica captura ativa sem quarentena como andamento", () => {
    const activeSnapshot = snapshot();

    expect(bucketForSystemCapture("captada", "Em andamento", "C16:NEW", activeSnapshot, COMERCIAL_CATEGORY)).toBe("andamento");
  });

  it("ignora quarentena fora do Comercial Geral", () => {
    const otherCategory = snapshot({ categoryId: "36", dealStatus: "4128", stageId: "C36:EXECUTING" });

    expect(isQuarentenaComercialGeral(otherCategory, COMERCIAL_CATEGORY)).toBe(false);
    expect(bucketForSystemCapture("captada", "Em andamento", "C36:EXECUTING", otherCategory, COMERCIAL_CATEGORY)).toBe("andamento");
  });

  it("respeita o filtro de data usando captada_em da oportunidade", () => {
    const range = { de: "2026-08-05", ate: "2026-08-05" };
    const quarantineSnapshot = snapshot({ dealStatus: "4128" });

    expect(isDateInResultadosRange("2026-08-05T18:30:00.000Z", range)).toBe(true);
    expect(isDateInResultadosRange("2026-08-04T18:30:00.000Z", range)).toBe(false);
    expect(bucketForSystemCapture("captada", "Quarentena", "C16:NEW", quarantineSnapshot, COMERCIAL_CATEGORY)).toBe("quarentena");
  });
});
