"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardCheck, LifeBuoy, LogOut, Network, Settings2, UserRoundSearch } from "lucide-react";
import { BrandMark } from "./brand-mark";

const navigation = [
  { href: "/corretor", label: "Minha carteira", icon: UserRoundSearch, count: undefined },
  { href: "/roletas", label: "Roletas", icon: Network, count: undefined },
  { href: "/auditorias", label: "Auditorias", icon: ClipboardCheck, count: 3 },
  { href: "/dashboard", label: "Produtividade", icon: BarChart3, count: undefined },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <BrandMark />
          <span className="environment">OPERACAO COMERCIAL</span>
        </div>
        <nav className="primary-nav" aria-label="Navegacao principal">
          {navigation.map(({ href, label, icon: Icon, count }) => {
            const active = pathname === href;
            return <Link className={active ? "nav-link active" : "nav-link"} href={href} key={href} aria-current={active ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {count ? <span className="nav-count">{count}</span> : null}
            </Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/configuracoes" className="nav-link"><Settings2 size={18} aria-hidden="true" />Configuracoes</Link>
          <Link href="/ajuda" className="nav-link"><LifeBuoy size={18} aria-hidden="true" />Ajuda</Link>
          <div className="profile-summary">
            <span className="avatar">MP</span>
            <span><strong>Marcela Parahyba</strong><small>Lider · Equipe Jordao</small></span>
            <Link href="/login" title="Sair"><LogOut size={17} aria-label="Sair" /></Link>
          </div>
        </div>
      </aside>
      <div className="mobile-header"><BrandMark /><span className="avatar">MP</span></div>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Navegacao movel">
        {navigation.map(({ href, label, icon: Icon, count }) => <Link href={href} key={href} className={pathname === href ? "active" : ""} aria-label={label}>
          <Icon size={20} aria-hidden="true" />{count ? <span>{count}</span> : null}
        </Link>)}
      </nav>
    </div>
  );
}
