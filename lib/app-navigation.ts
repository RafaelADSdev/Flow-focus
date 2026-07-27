import { BarChart3, ClipboardCheck, Columns3, Network, UserRoundSearch } from "lucide-react";

export const appNavigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined },
  { href: "/comercial-geral", label: "Comercial Geral", icon: Columns3, count: undefined },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: undefined },
  { href: "/dashboard", label: "Visão geral", icon: BarChart3, count: undefined },
] as const;
