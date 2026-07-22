import { BarChart3, ClipboardCheck, Network, UserRoundSearch } from "lucide-react";

export const appNavigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: undefined },
  { href: "/dashboard", label: "Produtividade", icon: BarChart3, count: undefined },
] as const;
