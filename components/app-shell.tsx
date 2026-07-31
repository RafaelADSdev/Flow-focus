"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings2, X } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { canAccessPath } from "@/lib/auth/paginas-acesso";
import type { AppUser } from "@/lib/types/app-user";
import { appNavigation, splitMobileNavigation } from "@/lib/app-navigation";
import { formatUserRole, greetingForName } from "@/lib/greeting";
import { AppTopbar } from "./app-topbar";
import { BrandMark } from "./brand-mark";
import { PartnerBrandLockup } from "./partner-brand-lockup";

function MobileGreeting({ user }: { user: AppUser }) {
  const [greeting, setGreeting] = useState(() => greetingForName(user.nome));

  useEffect(() => {
    const interval = window.setInterval(() => setGreeting(greetingForName(user.nome)), 60_000);
    return () => window.clearInterval(interval);
  }, [user.nome]);

  return (
    <div className="mobile-greeting">
      <p className="mobile-greeting-title">{greeting}</p>
      <p className="mobile-greeting-meta">{formatUserRole(user.perfil, user.equipeNome)}</p>
    </div>
  );
}

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false);
  const visibleNav = useMemo(
    () => appNavigation.filter((item) => canAccessPath(user.paginasAcesso, item.href)),
    [user.paginasAcesso],
  );
  const canSeeSettings = canAccessPath(user.paginasAcesso, "/configuracoes");
  const { primary: mobilePrimaryNav, overflow: mobileOverflowNav } = useMemo(
    () => splitMobileNavigation(visibleNav),
    [visibleNav],
  );
  const mobileNavItemCount = mobilePrimaryNav.length + (mobileOverflowNav.length ? 1 : 0);
  const mobileOverflowActive = mobileOverflowNav.some((item) => pathname === item.href);

  useEffect(() => {
    if (!mobileOverflowOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOverflowOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOverflowOpen]);

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="sidebar-top">
          {!collapsed ? <PartnerBrandLockup tone="on-dark" /> : null}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.6} /> : <PanelLeftClose size={18} strokeWidth={1.6} />}
          </button>
        </div>
        <nav className="primary-nav" aria-label="Navegação principal">
          {visibleNav.map(({ href, label, icon: Icon, count }) => {
            const active = pathname === href;
            return (
              <Link
                className={active ? "nav-link active" : "nav-link"}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                <span className="nav-label">{label}</span>
                {count ? <span className="nav-count">{count}</span> : null}
              </Link>
            );
          })}
          {canSeeSettings ? (
            <Link
              href="/configuracoes"
              className={pathname.startsWith("/configuracoes") ? "nav-link active" : "nav-link"}
              title={collapsed ? "Configurações" : undefined}
            >
              <Settings2 size={18} strokeWidth={1.6} aria-hidden="true" />
              <span className="nav-label">Configurações</span>
            </Link>
          ) : null}
        </nav>
      </aside>

      <div className="shell-main">
        <div className="mobile-header">
          <BrandMark variant="on-light" />
          <MobileGreeting key={user.nome} user={user} />
          <div className="mobile-header-actions">
            {canSeeSettings ? (
              <Link href="/configuracoes" className="mobile-header-icon" aria-label="Configurações">
                <Settings2 size={18} strokeWidth={1.6} aria-hidden="true" />
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button type="submit" className="mobile-header-icon" aria-label="Sair">
                <LogOut size={18} strokeWidth={1.6} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <AppTopbar user={user} />
        <main className="main-content">{children}</main>
      </div>

      <nav className={`mobile-nav mobile-nav--${mobileNavItemCount}`} aria-label="Navegação móvel">
        {mobilePrimaryNav.map(({ href, label, icon: Icon, count }) => (
          <Link
            href={href}
            key={href}
            className={pathname === href ? "active" : ""}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setMobileOverflowOpen(false)}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="mobile-nav-label">{label}</span>
            {count ? <span className="mobile-nav-count">{count}</span> : null}
          </Link>
        ))}
        {mobileOverflowNav.length ? (
          <div className={`mobile-nav-more${mobileOverflowActive ? " active" : ""}`}>
            <button
              type="button"
              className="mobile-nav-more-trigger"
              aria-expanded={mobileOverflowOpen}
              aria-controls="mobile-nav-overflow"
              aria-label={mobileOverflowOpen ? "Fechar mais destinos" : "Abrir mais destinos"}
              onClick={() => setMobileOverflowOpen((value) => !value)}
            >
              {mobileOverflowOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              <span className="mobile-nav-label">Mais</span>
            </button>
            {mobileOverflowOpen ? (
              <div id="mobile-nav-overflow" className="mobile-nav-overflow" role="group" aria-label="Mais destinos">
                {mobileOverflowNav.map(({ href, label, icon: Icon }) => (
                  <Link
                    href={href}
                    key={href}
                    className={pathname === href ? "active" : ""}
                    aria-current={pathname === href ? "page" : undefined}
                    onClick={() => setMobileOverflowOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
