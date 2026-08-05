import { describe, expect, it } from "vitest";
import {
  formatResultadosDateRange,
  isDateInResultadosRange,
  parseResultadosDateRange,
} from "@/lib/resultados-filters";

describe("resultados filters", () => {
  it("keeps the full history when no dates are provided", () => {
    expect(parseResultadosDateRange({})).toBeNull();
  });

  it("normalizes a custom interval even when dates arrive inverted", () => {
    const range = parseResultadosDateRange({ de: "2026-08-05", ate: "2026-08-01" });

    expect(range).toEqual({ de: "2026-08-01", ate: "2026-08-05" });
    expect(formatResultadosDateRange(range)).toContain("2026");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseResultadosDateRange({ de: "2026-02-30", ate: "2026-03-01" })).toBeNull();
  });

  it("includes the complete final day", () => {
    const range = { de: "2026-08-05", ate: "2026-08-05" };

    expect(isDateInResultadosRange("2026-08-05T23:59:59.999Z", range)).toBe(true);
    expect(isDateInResultadosRange("2026-08-06T12:00:00.000Z", range)).toBe(false);
  });
});
