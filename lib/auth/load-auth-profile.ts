import "server-only";

import type { User } from "@supabase/supabase-js";
import type { PerfilUsuario } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import { canManageOperacao, mapPerfil } from "@/lib/auth/perfil";

export type LoadedAuthProfile = {
  nome: string;
  perfil: PerfilUsuario;
  equipeId: string | null;
  equipeNome: string | null;
  ativo: boolean;
};

function nomeFromAuth(authUser: User): string {
  return (
    (typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome : null)
    ?? authUser.email?.split("@")[0]
    ?? "Usuário"
  );
}

async function readUsuarioProfile(authUser: User) {
  if (hasSupabaseSecretKey()) {
    const admin = createAdminClient();
    return admin
      .from("usuarios")
      .select("nome, perfil, equipe_id, equipe_nome, ativo")
      .eq("id", authUser.id)
      .maybeSingle();
  }

  const supabase = await createClient();
  return supabase
    .from("usuarios")
    .select("nome, perfil, equipe_id, equipe_nome, ativo")
    .eq("id", authUser.id)
    .maybeSingle();
}

export async function loadAuthProfile(authUser: User): Promise<LoadedAuthProfile | null> {
  const perfilFromAuth = mapPerfil(String(authUser.app_metadata?.perfil ?? ""));
  const { data: profile, error } = await readUsuarioProfile(authUser);

  if (!error && profile) {
    if (!profile.ativo) return null;

    return {
      nome: profile.nome,
      perfil: profile.perfil ?? perfilFromAuth,
      equipeId: profile.equipe_id,
      equipeNome: profile.equipe_nome,
      ativo: profile.ativo,
    };
  }

  if (canManageOperacao(perfilFromAuth)) {
    return {
      nome: nomeFromAuth(authUser),
      perfil: perfilFromAuth,
      equipeId: null,
      equipeNome: null,
      ativo: true,
    };
  }

  return null;
}
