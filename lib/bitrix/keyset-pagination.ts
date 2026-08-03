type BitrixItemWithId = {
  ID?: unknown;
};

function numericId(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("Bitrix retornou um item sem ID numérico durante a paginação.");
  }
  return id;
}

/**
 * Percorre listas grandes do Bitrix por ID crescente e `start=-1`.
 * Assim o Bitrix não recalcula o total em todas as páginas.
 */
export async function collectBitrixPagesById<T extends BitrixItemWithId>(
  fetchPageAfterId: (lastId: string) => Promise<T[]>,
  pageSize = 50,
) {
  const items: T[] = [];
  let lastId = "0";

  while (true) {
    const page = await fetchPageAfterId(lastId);
    if (page.length === 0) break;

    items.push(...page);
    const nextLastId = numericId(page.at(-1)?.ID);
    if (BigInt(nextLastId) <= BigInt(lastId)) {
      throw new Error("A paginação do Bitrix não avançou para o próximo ID.");
    }

    lastId = nextLastId;
    if (page.length < pageSize) break;
  }

  return items;
}
