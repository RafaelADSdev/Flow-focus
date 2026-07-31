import "server-only";

type CacheEntry<T> = { value: T; expiresAt: number };

const values = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const current = values.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > Date.now()) return current.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = load().then((value) => {
    values.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of values.keys()) {
    if (key.startsWith(prefix)) values.delete(key);
  }
}

export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}
