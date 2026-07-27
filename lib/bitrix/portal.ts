import "server-only";

/**
 * Portal Bitrix (origem sem /rest/…) para deep-links de CRM.
 * Aceita webhook completo (`…/rest/USER/CODE`) ou só a base (`…/rest`).
 */
export function getBitrixPortalBaseUrl() {
  const raw = process.env.BITRIX24_BASE_URL?.trim() ?? "";
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    // Fallback para valores sem protocolo válido
    return raw
      .replace(/\/$/, "")
      .replace(/\/rest(?:\/.*)?$/i, "");
  }
}

/** Deep-link do negócio: /crm/deal/details/{bitrixDealId}/ */
export function bitrixDealDetailsUrl(dealId: string, portalBase = getBitrixPortalBaseUrl()) {
  const id = dealId.trim();
  if (!portalBase || !id) return null;
  return `${portalBase}/crm/deal/details/${encodeURIComponent(id)}/`;
}
