import "server-only";

import type { AppUser } from "@/lib/types/app-user";
import { defaultPaginasForPerfil } from "@/lib/auth/paginas-acesso";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";

export type { AppUser } from "@/lib/types/app-user";

export function getFallbackUser(): AppUser {
  return {
    nome: "Usuário",
    perfil: "corretor",
    equipeNome: null,
    iniciais: "US",
    fotoUrl: null,
    paginasAcesso: defaultPaginasForPerfil("corretor"),
  };
}

export async function getCurrentUser(): Promise<AppUser> {
  if (!hasSupabaseEnv()) return getFallbackUser();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return getFallbackUser();

  const profile = await loadAuthProfile(authUser);
  if (!profile) return getFallbackUser();

  return {
    nome: profile.nome,
    perfil: profile.perfil,
    equipeNome: profile.equipeNome,
    iniciais: initials(profile.nome),
    fotoUrl: profile.fotoUrl,
    paginasAcesso: profile.paginasAcesso,
  };
}
