const PROTECTED_PAGE_PREFIXES = [
  "/auditorias",
  "/resultados",
  "/comercial-geral",
  "/configuracoes",
  "/corretor",
  "/dashboard",
  "/equipe",
  "/roletas",
] as const;

const PROTECTED_API_PREFIXES = ["/api/dados"] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isGeofenceConfigurationPath(pathname: string) {
  return pathname === "/configuracoes" || pathname === "/configuracoes/localizacao";
}

export function isGeofenceProtectedPage(pathname: string) {
  if (isGeofenceConfigurationPath(pathname)) return false;
  return PROTECTED_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGeofenceProtectedApi(pathname: string) {
  return PROTECTED_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGeofenceProtectedRequest(pathname: string) {
  return isGeofenceProtectedPage(pathname) || isGeofenceProtectedApi(pathname);
}

export function isGeofenceVerificationPath(pathname: string) {
  return pathname === "/verificar-localizacao" || pathname === "/api/verificar-localizacao";
}

export function sanitizeGeofenceReturnPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/corretor";

  try {
    const url = new URL(candidate, "https://flow-focus.local");
    if (!isGeofenceProtectedPage(url.pathname)) return "/corretor";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/corretor";
  }
}
