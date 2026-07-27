import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AppUser } from "@/lib/types/app-user";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";

export async function requireAdmin(redirectTo: Route = "/configuracoes") {
  if (!hasSupabaseEnv()) {
    redirect(redirectTo);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    redirect("/login");
  }

  const profile = await loadAuthProfile(authUser);
  if (!profile || profile.perfil !== "admin" || !profile.ativo) {
    redirect(redirectTo);
  }

  const user: AppUser = {
    nome: profile.nome,
    perfil: profile.perfil,
    equipeNome: profile.equipeNome,
    iniciais: initials(profile.nome),
    paginasAcesso: profile.paginasAcesso,
  };

  return user;
}

export async function isAdmin() {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return false;

  const profile = await loadAuthProfile(authUser);
  return profile?.perfil === "admin" && profile.ativo === true;
}
