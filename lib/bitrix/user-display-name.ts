type BitrixUserNameFields = {
  NAME?: unknown;
  SECOND_NAME?: unknown;
  LAST_NAME?: unknown;
};

function cleanNamePart(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function mergeNameParts(parts: string[]) {
  const words: string[] = [];
  for (const part of parts) {
    const next = part.split(" ").filter(Boolean);
    let overlap = Math.min(words.length, next.length);
    while (overlap > 0) {
      const currentSuffix = words.slice(-overlap).join(" ").toLocaleLowerCase("pt-BR");
      const nextPrefix = next.slice(0, overlap).join(" ").toLocaleLowerCase("pt-BR");
      if (currentSuffix === nextPrefix) break;
      overlap -= 1;
    }
    words.push(...next.slice(overlap));
  }
  return words.join(" ");
}

export function displayNameFromEmail(email: string) {
  const local = email.trim().split("@")[0] || email.trim();
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1).toLocaleLowerCase("pt-BR"))
    .join(" ") || "Usuário";
}

export function displayNameFromBitrix(user: BitrixUserNameFields | null | undefined) {
  if (!user) return "";
  return mergeNameParts([user.NAME, user.SECOND_NAME, user.LAST_NAME]
    .map(cleanNamePart)
    .filter(Boolean));
}

export function resolveUserDisplayName({
  bitrixUser,
  existingName,
  email,
}: {
  bitrixUser?: BitrixUserNameFields | null;
  existingName?: string | null;
  email: string;
}) {
  const bitrixName = displayNameFromBitrix(bitrixUser);
  if (bitrixName) return bitrixName;

  const current = cleanNamePart(existingName);
  if (current && current.toLocaleLowerCase("pt-BR") !== email.trim().toLocaleLowerCase("pt-BR")) {
    return current;
  }

  return displayNameFromEmail(email);
}
