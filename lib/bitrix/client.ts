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
  total?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Bitrix devolve 429 em dois casos bem diferentes: QUERY_LIMIT_EXCEEDED é o teto por segundo e
// passa sozinho, mas OPERATION_TIME_LIMIT bloqueia o método por minutos — insistir só queima mais
// orçamento e devolve um erro genérico no fim.
const METHOD_BLOCKED_ERROR = "OPERATION_TIME_LIMIT";

async function readBitrixErrorCode(response: Response) {
  try {
    const body = await response.json() as BitrixResponse<unknown>;
    return String(body.error ?? "");
  } catch {
    return "";
  }
}

async function fetchBitrixPage<T>(url: URL, timeoutMs: number) {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 429 || response.status === 503 || response.status === 502) {
      if (await readBitrixErrorCode(response) === METHOD_BLOCKED_ERROR) {
        throw new Error(
          "O Bitrix24 bloqueou temporariamente esta consulta por excesso de tempo de operação. Tente novamente em alguns minutos.",
        );
      }
      if (attempt < maxAttempts) {
        await sleep((response.status === 429 ? 1_500 : 2_000) * attempt);
        continue;
      }
    }

    if (!response.ok) {
      throw new Error(`Bitrix respondeu HTTP ${response.status}`);
    }

    const body = await response.json() as BitrixResponse<T>;
    if (body.error || body.result === undefined) {
      throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
    }

    return { result: body.result, next: body.next, total: body.total };
  }

  throw new Error("Bitrix indisponível após várias tentativas.");
}

export async function bitrixCall<T>(method: string, params?: URLSearchParams) {
  const page = await bitrixCallPage<T>(method, params);
  return page.result;
}

export async function bitrixCallPage<T>(method: string, params?: URLSearchParams, timeoutMs = 15_000) {
  const url = new URL(`${getBitrixBaseUrl()}/${method}.json`);
  params?.forEach((value, key) => url.searchParams.append(key, value));
  return fetchBitrixPage<T>(url, timeoutMs);
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
