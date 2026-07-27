import { describe, expect, it } from "vitest";
import {
  countActiveDashboardFilters,
  dashboardFiltersToSearchParams,
  dashboardPeriodDays,
  parseDashboardFilters,
} from "./dashboard-filters";

describe("filtros da visão geral", () => {
  it("normaliza um período invertido e preserva os recortes", () => {
    expect(parseDashboardFilters({
      de: "2026-07-20",
      ate: "2026-07-10",
      equipe: "focus-elite",
      corretor: "corretor-1",
      roleta: "Roleta Focus",
    })).toMatchObject({
      de: "2026-07-10",
      ate: "2026-07-20",
      equipe: "focus-elite",
      corretor: "corretor-1",
      roleta: "Roleta Focus",
    });
  });

  it("conta o período de forma inclusiva", () => {
    expect(dashboardPeriodDays({ de: "2026-07-10", ate: "2026-07-20" })).toBe(11);
  });

  it("serializa apenas os filtros ativos", () => {
    const filters = parseDashboardFilters({ equipe: "focus-total", roleta: "Roleta A" });
    const params = dashboardFiltersToSearchParams(filters);

    expect(params.get("equipe")).toBe("focus-total");
    expect(params.get("roleta")).toBe("Roleta A");
    expect(params.has("corretor")).toBe(false);
    expect(countActiveDashboardFilters(filters)).toBe(2);
  });
});
