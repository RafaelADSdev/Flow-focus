import { BarChart3, ClipboardCheck, Network, UserRoundSearch, UsersRound } from "lucide-react";

export const appNavigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined },
  { href: "/equipe", label: "Equipe", icon: UsersRound, count: undefined },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: undefined },
  { href: "/dashboard", label: "Visão geral", icon: BarChart3, count: undefined },
] as const;
