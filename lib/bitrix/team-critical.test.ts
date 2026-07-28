import { describe, expect, it } from "vitest";
import { assessCriticalDeal, isDueRdStationLead } from "./team-critical";

const NOW = new Date("2026-07-28T12:00:00.000Z").getTime();

function deal(overrides: Record<string, unknown> = {}) {
  return {
    DATE_MODIFY: "2026-07-28T12:00:00.000Z",
    STAGE_ID: "C16:ANDAMENTO",
    UF_CRM_1726667595972: "Focus",
    UF_CRM_1726060110: null,
    ...overrides,
  };
}

describe("assessCriticalDeal", () => {
  it("ignora leads sem Roleta Atual", () => {
    const result = assessCriticalDeal(
      deal({ UF_CRM_1726667595972: "", DATE_MODIFY: "2026-07-20T12:00:00.000Z" }),
      "Em andamento",
      { now: NOW },
    );
    expect(result.critical).toBe(false);
  });

  it("marca parado há mais de 2 dias em qualquer etapa", () => {
    const result = assessCriticalDeal(
      deal({ DATE_MODIFY: "2026-07-24T12:00:00.000Z" }),
      "Tentativa de contato",
      { now: NOW },
    );
    expect(result.critical).toBe(true);
    expect(result.stagnant).toBe(true);
    expect(result.expiringSoon).toBe(false);
  });

  it("não marca parado com exatamente 2 dias", () => {
    const result = assessCriticalDeal(
      deal({ DATE_MODIFY: "2026-07-26T12:00:00.000Z" }),
      "Tentativa de contato",
      { now: NOW },
    );
    expect(result.stagnant).toBe(false);
  });

  it("marca EM ANDAMENTO com Prazo Padrão em até 7 dias", () => {
    const result = assessCriticalDeal(
      deal({ UF_CRM_1726060110: "2026-08-01T12:00:00.000Z" }),
      "Em andamento",
      { now: NOW },
    );
    expect(result.critical).toBe(true);
    expect(result.expiringSoon).toBe(true);
    expect(result.deadline?.toISOString()).toBe("2026-08-01T12:00:00.000Z");
  });

  it("não usa prazo padrão fora de EM ANDAMENTO", () => {
    const result = assessCriticalDeal(
      deal({ UF_CRM_1726060110: "2026-08-01T12:00:00.000Z", DATE_MODIFY: "2026-07-28T12:00:00.000Z" }),
      "Tentativa de contato",
      { now: NOW },
    );
    expect(result.expiringSoon).toBe(false);
    expect(result.critical).toBe(false);
  });
});

describe("isDueRdStationLead", () => {
  it("detecta DUE no título mesmo sem origem RD Station", () => {
    expect(isDueRdStationLead({ title: "Denise", roletaAtual: "DUE · Focus" })).toBe(true);
  });

  it("detecta origem RD Station com DUE", () => {
    expect(isDueRdStationLead({ sourceName: "DUE · RD Station" })).toBe(true);
  });
});
