import type { PerfilUsuario } from "@/lib/database.types";

export const appPageOptions = [
  { href: "/corretor", label: "Minha carteira" },
  { href: "/roletas", label: "Roletas" },
  { href: "/equipe", label: "Equipe" },
  { href: "/auditorias", label: "Auditorias" },
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
      return ["/corretor", "/roletas", "/equipe", "/auditorias"];
    case "admin":
      return ["/corretor", "/roletas", "/equipe", "/auditorias", "/configuracoes"];
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

  const allowedForProfile = perfil === "admin"
    ? cleaned
    : cleaned.filter((page) => page !== "/configuracoes");

  if (!allowedForProfile.length) {
    return defaultPaginasForPerfil(perfil);
  }

  // Minha carteira é a entrada de captação — sempre liberada para qualquer perfil.
  return [...new Set(["/corretor" as PaginaAcesso, ...allowedForProfile])];
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
