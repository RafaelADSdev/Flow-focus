import { ChartNoAxesCombined, ClipboardCheck, Network, UserRoundSearch, UsersRound } from "lucide-react";

export const MOBILE_NAV_SLOTS = 4;

export const appNavigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined, mobilePriority: 1 },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined, mobilePriority: 4 },
  { href: "/equipe", label: "Equipe", icon: UsersRound, count: undefined, mobilePriority: 2 },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: undefined, mobilePriority: 3 },
  { href: "/resultados", label: "Resultados", icon: ChartNoAxesCombined, count: undefined, mobilePriority: 5 },
] as const;

export function splitMobileNavigation<T extends { mobilePriority: number }>(items: readonly T[]) {
  const ordered = [...items].sort((left, right) => left.mobilePriority - right.mobilePriority);
  if (ordered.length <= MOBILE_NAV_SLOTS) {
    return { primary: ordered, overflow: [] as T[] };
  }

  const primary = ordered.slice(0, MOBILE_NAV_SLOTS - 1);
  const primaryItems = new Set(primary);

  return {
    primary,
    overflow: ordered.filter((item) => !primaryItems.has(item)),
  };
}
