import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, MapPinned, Shield, SlidersHorizontal } from "lucide-react";
import { isAdmin } from "@/lib/auth/require-admin";

export const metadata = { title: "Configurações" };

const settingsLinks = [
  {
    href: "/configuracoes/localizacao",
    title: "Localiza\u00e7\u00e3o do escrit\u00f3rio",
    description: "Defina o ponto central e o raio que liberam o acesso ao Flow Focus.",
    icon: MapPinned,
    adminOnly: true,
  },
  {
    href: "/configuracoes/acesso",
    title: "Gestão de acesso",
    description: "Crie, edite ou desative acessos. Ajuste visão, páginas, esteira e equipe.",
    icon: Shield,
    adminOnly: true,
  },
  {
    href: "/roletas",
    title: "Permissões de roleta",
    description: "Defina quais roletas cada corretor pode visualizar e captar.",
    icon: SlidersHorizontal,
    adminOnly: false,
  },
] as const;

export default async function SettingsPage() {
  const admin = await isAdmin();
  const visibleLinks = settingsLinks.filter((link) => !link.adminOnly || admin);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Configurações</h1>
          <p>Integrações, permissões e parâmetros gerais do Flow Focus.</p>
        </div>
      </header>
      <div className="settings-grid">
        {visibleLinks.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href as Route} className="settings-card">
            <span className="settings-card-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </>
  );
}
