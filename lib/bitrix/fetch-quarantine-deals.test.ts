import { beforeEach, describe, expect, it, vi } from "vitest";

const { bitrixCallPage } = vi.hoisted(() => ({ bitrixCallPage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bitrix/cache", () => ({
  cached: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
}));
vi.mock("@/lib/bitrix/client", () => ({
  bitrixCallPage,
  hasBitrixEnv: () => true,
}));

describe("fetchQuarantineDeals", () => {
  beforeEach(() => {
    bitrixCallPage.mockReset();
    delete process.env.BITRIX24_QUARANTINE_STATUS_VALUE;
  });

  it("consulta o status de quarentena e percorre todas as páginas", async () => {
    bitrixCallPage
      .mockResolvedValueOnce({
        result: Array.from({ length: 50 }, (_, index) => ({
          ID: String(index + 1),
          TITLE: `Lead ${index + 1}`,
          CATEGORY_ID: "16",
          ASSIGNED_BY_ID: "86",
          UF_CRM_1717073472: "4128",
        })),
        next: 50,
      })
      .mockResolvedValueOnce({
        result: [{
          ID: "51",
          TITLE: "Lead 51",
          CATEGORY_ID: "16",
          ASSIGNED_BY_ID: "86",
          UF_CRM_1717073472: "4128",
        }],
      });

    const { fetchQuarantineDeals } = await import("@/lib/bitrix/fetch-quarantine-deals");
    const deals = await fetchQuarantineDeals("16");

    expect(deals).toHaveLength(51);
    expect(bitrixCallPage).toHaveBeenCalledTimes(2);

    const firstQuery = bitrixCallPage.mock.calls[0][1] as URLSearchParams;
    const secondQuery = bitrixCallPage.mock.calls[1][1] as URLSearchParams;
    expect(firstQuery.get("filter[=CATEGORY_ID]")).toBe("16");
    expect(firstQuery.get("filter[=UF_CRM_1717073472]")).toBe("4128");
    expect(firstQuery.get("start")).toBe("0");
    expect(secondQuery.get("start")).toBe("50");
  });
});
