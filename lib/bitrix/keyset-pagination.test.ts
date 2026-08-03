import { describe, expect, it, vi } from "vitest";
import { collectBitrixPagesById } from "./keyset-pagination";

describe("collectBitrixPagesById", () => {
  it("percorre páginas usando o último ID recebido", async () => {
    const fetchPage = vi.fn(async (lastId: string) => {
      if (lastId === "0") return [{ ID: "10" }, { ID: "20" }];
      if (lastId === "20") return [{ ID: "25" }];
      return [];
    });

    await expect(collectBitrixPagesById(fetchPage, 2)).resolves.toEqual([
      { ID: "10" },
      { ID: "20" },
      { ID: "25" },
    ]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, "0");
    expect(fetchPage).toHaveBeenNthCalledWith(2, "20");
  });

  it("interrompe quando a última página tem menos itens que o limite", async () => {
    const fetchPage = vi.fn(async () => [{ ID: "7" }]);

    await expect(collectBitrixPagesById(fetchPage, 50)).resolves.toEqual([{ ID: "7" }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejeita uma página que não avança o ID", async () => {
    const fetchPage = vi.fn(async () => [{ ID: "10" }, { ID: "10" }]);

    await expect(collectBitrixPagesById(fetchPage, 2)).rejects.toThrow(
      "A paginação do Bitrix não avançou",
    );
  });
});
