import type { PerfilUsuario } from "@/lib/database.types";
import { canManageOperacao } from "@/lib/auth/perfil";

export const appPageOptions = [
  { href: "/corretor", label: "Minha carteira" },
  { href: "/roletas", label: "Roletas" },
  { href: "/equipe", label: "Equipe" },
  { href: "/auditorias", label: "Auditorias" },
  { href: "/configuracoes", label: "Configurações", adminOnly: true },
] as const;

/** Rotas concedidas fora do painel de acesso (migrations, perfil operacional). */
export const hiddenPaginasAcesso = ["/comercial-geral", "/dashboard"] as const;

export type VisiblePaginaAcesso = (typeof appPageOptions)[number]["href"];
export type HiddenPaginaAcesso = (typeof hiddenPaginasAcesso)[number];
export type PaginaAcesso = VisiblePaginaAcesso | HiddenPaginaAcesso;

export const paginaAcessoValues = appPageOptions.map((page) => page.href) as [
  VisiblePaginaAcesso,
  ...VisiblePaginaAcesso[],
];

export function defaultPaginasForPerfil(perfil: PerfilUsuario): VisiblePaginaAcesso[] {
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

function extractHiddenPaginas(paginas: readonly string[] | null | undefined): HiddenPaginaAcesso[] {
  const allowed = new Set<string>(hiddenPaginasAcesso);
  return [...new Set(
    (paginas ?? [])
      .map((page) => page.trim())
      .filter((page): page is HiddenPaginaAcesso => allowed.has(page)),
  )];
}

function hiddenPaginasForPerfil(perfil: PerfilUsuario): HiddenPaginaAcesso[] {
  return canManageOperacao(perfil) ? ["/comercial-geral"] : [];
}

export function normalizePaginasAcesso(
  perfil: PerfilUsuario,
  paginas: readonly string[] | null | undefined,
): VisiblePaginaAcesso[] {
  const allowed = new Set<string>(paginaAcessoValues);
  const cleaned = (paginas ?? [])
    .map((page) => page.trim())
    .filter((page): page is VisiblePaginaAcesso => allowed.has(page));

  const allowedForProfile = perfil === "admin"
    ? cleaned
    : cleaned.filter((page) => page !== "/configuracoes");

  if (!allowedForProfile.length) {
    return defaultPaginasForPerfil(perfil);
  }

  // Minha carteira é a entrada de captação — sempre liberada para qualquer perfil.
  return [...new Set(["/corretor" as VisiblePaginaAcesso, ...allowedForProfile])];
}

export function resolvePaginasAcesso(
  perfil: PerfilUsuario,
  paginas: readonly string[] | null | undefined,
): PaginaAcesso[] {
  const visible = normalizePaginasAcesso(perfil, paginas);
  const hidden = [...new Set([...extractHiddenPaginas(paginas), ...hiddenPaginasForPerfil(perfil)])];
  return [...visible, ...hidden];
}

export function canAccessPath(paginas: readonly string[], pathname: string): boolean {
  if (pathname.startsWith("/configuracoes")) {
    return paginas.includes("/configuracoes");
  }

  for (const href of hiddenPaginasAcesso) {
    if (paginas.includes(href) && (pathname === href || pathname.startsWith(`${href}/`))) {
      return true;
    }
  }

  return appPageOptions.some(
    (page) => paginas.includes(page.href) && (pathname === page.href || pathname.startsWith(`${page.href}/`)),
  );
}

export function firstAllowedPath(paginas: readonly string[]): VisiblePaginaAcesso {
  for (const page of appPageOptions) {
    if (paginas.includes(page.href)) return page.href;
  }
  return "/corretor";
}

export function pageLabel(href: string): string {
  return appPageOptions.find((page) => page.href === href)?.label ?? href;
}
