import { describe, expect, it } from "vitest";
import { appNavigation, MOBILE_NAV_SLOTS, splitMobileNavigation } from "@/lib/app-navigation";

describe("splitMobileNavigation", () => {
  it("mantém no máximo quatro slots na barra móvel", () => {
    const { primary, overflow } = splitMobileNavigation(appNavigation);

    expect(primary).toHaveLength(MOBILE_NAV_SLOTS - 1);
    expect(overflow).toHaveLength(2);
    expect(primary.length + (overflow.length ? 1 : 0)).toBeLessThanOrEqual(MOBILE_NAV_SLOTS);
  });

  it("preserva todos os destinos visíveis e prioriza o fluxo operacional", () => {
    const { primary, overflow } = splitMobileNavigation(appNavigation);

    expect(primary.map((item) => item.href)).toEqual(["/corretor", "/equipe", "/auditorias"]);
    expect([...primary, ...overflow].map((item) => item.href).sort()).toEqual(
      appNavigation.map((item) => item.href).sort(),
    );
  });
});
