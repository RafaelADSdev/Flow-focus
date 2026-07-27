import type { PerfilUsuario } from "@/lib/database.types";

export const appPageOptions = [
  { href: "/corretor", label: "Minha carteira" },
  { href: "/roletas", label: "Roletas" },
  { href: "/comercial-geral", label: "Comercial Geral", managerOnly: true },
  { href: "/auditorias", label: "Auditorias" },
  { href: "/dashboard", label: "Visão geral" },
  { href: "/configuracoes", label: "Configurações", adminOnly: true },
] as const;

export type PaginaAcesso = (typeof appPageOptions)[number]["href"];

export const paginaAcessoValues = appPageOptions.map((page) => page.href) as [
  PaginaAcesso,
  ...PaginaAcesso[],
];

export function defaultPaginasForPerfil(perfil: PerfilUsuario): PaginaAcesso[] {
  switch (perfil) {
    case "corretor":
      return ["/corretor"];
    case "lider":
    case "diretora":
      return ["/roletas", "/comercial-geral", "/auditorias", "/dashboard"];
    case "admin":
      return ["/corretor", "/roletas", "/comercial-geral", "/auditorias", "/dashboard", "/configuracoes"];
    default:
      return ["/corretor"];
  }
}

export function normalizePaginasAcesso(
  perfil: PerfilUsuario,
  paginas: readonly string[] | null | undefined,
): PaginaAcesso[] {
  const allowed = new Set<string>(paginaAcessoValues);
  const cleaned = (paginas ?? [])
    .map((page) => page.trim())
    .filter((page): page is PaginaAcesso => allowed.has(page));

  const withoutConfig = perfil === "admin"
    ? cleaned
    : cleaned.filter((page) => page !== "/configuracoes");
  const allowedForProfile = perfil === "corretor"
    ? withoutConfig.filter((page) => page !== "/comercial-geral")
    : withoutConfig;

  const legacyDefaults = perfil === "admin"
    ? ["/corretor", "/roletas", "/auditorias", "/dashboard", "/configuracoes"]
    : perfil === "lider" || perfil === "diretora"
      ? ["/roletas", "/auditorias", "/dashboard"]
      : [];
  const isLegacyDefault = legacyDefaults.length === allowedForProfile.length
    && legacyDefaults.every((page) => allowedForProfile.includes(page as PaginaAcesso));
  if (isLegacyDefault) {
    const auditIndex = allowedForProfile.indexOf("/auditorias");
    const next = [...allowedForProfile];
    next.splice(auditIndex < 0 ? next.length : auditIndex, 0, "/comercial-geral");
    return next;
  }

  if (!allowedForProfile.length) {
    return defaultPaginasForPerfil(perfil);
  }

  return [...new Set(allowedForProfile)];
}

export function canAccessPath(paginas: readonly string[], pathname: string): boolean {
  if (pathname.startsWith("/configuracoes")) {
    return paginas.includes("/configuracoes");
  }

  return appPageOptions.some(
    (page) => paginas.includes(page.href) && (pathname === page.href || pathname.startsWith(`${page.href}/`)),
  );
}

export function firstAllowedPath(paginas: readonly string[]): PaginaAcesso {
  for (const page of appPageOptions) {
    if (paginas.includes(page.href)) return page.href;
  }
  return "/corretor";
}

export function pageLabel(href: string): string {
  return appPageOptions.find((page) => page.href === href)?.label ?? href;
}
