import "server-only";

export function getBitrixBaseUrl() {
  const baseUrl = process.env.BITRIX24_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!baseUrl) {
    throw new Error("BITRIX24_BASE_URL não configurada.");
  }
  return baseUrl;
}

export function hasBitrixEnv() {
  return Boolean(process.env.BITRIX24_BASE_URL);
}

type BitrixResponse<T> = {
  result?: T;
  error?: string;
  error_description?: string;
  next?: number;
};

export async function bitrixCall<T>(method: string, params?: URLSearchParams) {
  const page = await bitrixCallPage<T>(method, params);
  return page.result;
}

export async function bitrixCallPage<T>(method: string, params?: URLSearchParams) {
  const url = new URL(`${getBitrixBaseUrl()}/${method}.json`);
  params?.forEach((value, key) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Bitrix respondeu HTTP ${response.status}`);
  }

  const body = await response.json() as BitrixResponse<T>;
  if (body.error || body.result === undefined) {
    throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
  }

  return { result: body.result, next: body.next };
}

export async function bitrixCallJson<T>(method: string, payload: Record<string, unknown>) {
  const url = new URL(`${getBitrixBaseUrl()}/${method}.json`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Bitrix respondeu HTTP ${response.status}`);
  }

  const body = await response.json() as BitrixResponse<T>;
  if (body.error || body.result === undefined) {
    throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
  }

  return body.result;
}
