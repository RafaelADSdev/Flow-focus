import { ChartNoAxesCombined, ClipboardCheck, Network, UserRoundSearch, UsersRound } from "lucide-react";

export const appNavigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined },
  { href: "/equipe", label: "Equipe", icon: UsersRound, count: undefined },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: undefined },
  { href: "/resultados", label: "Resultados", icon: ChartNoAxesCombined, count: undefined },
] as const;
