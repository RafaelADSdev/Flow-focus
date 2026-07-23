import "server-only";

const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export function createAdminAuthStorage() {
  return noopStorage;
}

/**
 * Fetch isolado para operações com chave de serviço.
 * Em Server Actions o fetch padrão do Next pode reutilizar o JWT da sessão do
 * usuário logado; o GoTrue/PostgREST então tentam validar ES256 e falham com kid nil.
 */
export function createServiceRoleFetch(serviceKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", serviceKey);
    headers.set("Authorization", `Bearer ${serviceKey}`);

    return fetch(input, {
      ...init,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
  };
}
