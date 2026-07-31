import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { canViewResultados } from "@/lib/auth/perfil";
import { firstAllowedPath } from "@/lib/auth/paginas-acesso";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function requireResultadosAccess(redirectTo?: Route) {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    redirect("/login");
  }

  const profile = await loadAuthProfile(authUser);
  if (!profile || !profile.ativo || !canViewResultados(profile.perfil)) {
    redirect(redirectTo ?? firstAllowedPath(profile?.paginasAcesso ?? ["/corretor"]));
  }

  return profile;
}
