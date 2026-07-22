"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { AppUser } from "@/lib/types/app-user";
import { formatUserRole } from "@/lib/greeting";

export function AppTopbar({ user }: { user: AppUser }) {
  const roleLabel = formatUserRole(user.perfil, user.equipeNome);

  return (
    <header className="app-topbar">
      <div className="topbar-profile">
        <span className="avatar avatar-light">{user.iniciais}</span>
        <span className="topbar-profile-copy">
          <strong>{user.nome}</strong>
          <small>{roleLabel}</small>
        </span>
      </div>
      <div className="topbar-actions">
        <form action={signOutAction}>
          <button type="submit" className="button button-quiet topbar-action-btn">
            <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
            <span className="topbar-action-label">Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
