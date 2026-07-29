const textEncoder = new TextEncoder();

export const GEO_SESSION_COOKIE = "geo_sessao";

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function signatureToHex(signature: ArrayBuffer) {
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signatureFromHex(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function signedPayload(expiresAt: number, nonce: string, userId: string) {
  // Binding the signature to the user prevents copying a geo-session to another account.
  return `v1.${expiresAt}.${nonce}.${userId}`;
}

export async function createGeoSessionToken(
  userId: string,
  sessionSeconds: number,
  secret: string,
  now = Date.now(),
) {
  const expiresAt = now + sessionSeconds * 1_000;
  const nonce = randomNonce();
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(signedPayload(expiresAt, nonce, userId)),
  );

  return {
    expiresAt,
    token: `v1.${expiresAt}.${nonce}.${signatureToHex(signature)}`,
  };
}

export async function isValidGeoSessionToken(
  token: string | undefined,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  if (!token) return false;

  const [version, rawExpiresAt, nonce, rawSignature, ...unexpected] = token.split(".");
  const expiresAt = Number(rawExpiresAt);
  const signature = signatureFromHex(rawSignature ?? "");

  if (
    version !== "v1"
    || unexpected.length > 0
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now
    || !/^[a-f0-9]{32}$/i.test(nonce ?? "")
    || !signature
  ) {
    return false;
  }

  const key = await importSigningKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    textEncoder.encode(signedPayload(expiresAt, nonce, userId)),
  );
}

export function geoCookieOptions(sessionSeconds: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: sessionSeconds,
  };
}

export const expiredGeoCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 0,
  expires: new Date(0),
};

