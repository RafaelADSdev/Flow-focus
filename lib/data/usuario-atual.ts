import "server-only";

import type { PerfilUsuario } from "@/lib/database.types";
import type { AppUser } from "@/lib/types/app-user";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";

export type { AppUser } from "@/lib/types/app-user";

type LegacyProfile = {
  username: string | null;
  role: string | null;
  equipe_id: string | null;
};

function mapPerfil(value: string | null | undefined): PerfilUsuario {
  switch (value) {
    case "admin": return "admin";
    case "diretora":
    case "diretor": return "diretora";
    case "lider":
    case "leader": return "lider";
    default: return "corretor";
  }
}

function isMissingUsuariosTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205"
    || error.message?.includes("Could not find the table")
    || error.message?.includes("usuarios");
}

export function getFallbackUser(): AppUser {
  return {
    nome: "Usuário",
    perfil: "corretor",
    equipeNome: null,
    iniciais: "US",
  };
}

async function getLegacyProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, role, equipe_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as LegacyProfile;
}

export async function getCurrentUser(): Promise<AppUser> {
  if (!hasSupabaseEnv()) return getFallbackUser();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return getFallbackUser();

  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("nome, perfil, equipe_nome")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!error && profile) {
    return {
      nome: profile.nome,
      perfil: profile.perfil,
      equipeNome: profile.equipe_nome,
      iniciais: initials(profile.nome),
    };
  }

  if (isMissingUsuariosTable(error)) {
    const legacy = await getLegacyProfile(supabase, authUser.id);
    if (legacy?.username) {
      const nome = legacy.username;
      return {
        nome,
        perfil: mapPerfil(legacy.role),
        equipeNome: legacy.equipe_id,
        iniciais: initials(nome),
      };
    }
  }

  const nome =
    (typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome : null)
    ?? authUser.email?.split("@")[0]
    ?? "Usuário";

  return {
    nome,
    perfil: "corretor",
    equipeNome: null,
    iniciais: initials(nome),
  };
}
