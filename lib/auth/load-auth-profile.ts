import "server-only";

import type { User } from "@supabase/supabase-js";
import type { PerfilUsuario } from "@/lib/database.types";
import {
  defaultPaginasForPerfil,
  resolvePaginasAcesso,
  type PaginaAcesso,
} from "@/lib/auth/paginas-acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import { canManageOperacao, mapPerfil } from "@/lib/auth/perfil";

export type LoadedAuthProfile = {
  nome: string;
  perfil: PerfilUsuario;
  equipeId: string | null;
  equipeNome: string | null;
  paginasAcesso: PaginaAcesso[];
  ativo: boolean;
};

function nomeFromAuth(authUser: User): string {
  return (
    (typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome : null)
    ?? authUser.email?.split("@")[0]
    ?? "Usuário"
  );
}

type UsuarioProfileRow = {
  nome: string;
  perfil: PerfilUsuario | null;
  equipe_id: string | null;
  equipe_nome: string | null;
  paginas_acesso?: string[] | null;
  ativo: boolean;
};

async function readUsuarioProfile(authUser: User): Promise<{ data: UsuarioProfileRow | null; error: { message?: string } | null }> {
  async function query(select: string) {
    if (hasSupabaseSecretKey()) {
      const admin = createAdminClient();
      return admin.from("usuarios").select(select).eq("id", authUser.id).maybeSingle();
    }
    const supabase = await createClient();
    return supabase.from("usuarios").select(select).eq("id", authUser.id).maybeSingle();
  }

  const withPages = await query("nome, perfil, equipe_id, equipe_nome, paginas_acesso, ativo");
  if (withPages.error?.message?.includes("paginas_acesso")) {
    const fallback = await query("nome, perfil, equipe_id, equipe_nome, ativo");
    return {
      data: (fallback.data as UsuarioProfileRow | null) ?? null,
      error: fallback.error,
    };
  }

  return {
    data: (withPages.data as UsuarioProfileRow | null) ?? null,
    error: withPages.error,
  };
}

export async function loadAuthProfile(authUser: User): Promise<LoadedAuthProfile | null> {
  const perfilFromAuth = mapPerfil(String(authUser.app_metadata?.perfil ?? ""));
  const { data: profile, error } = await readUsuarioProfile(authUser);

  if (!error && profile) {
    if (!profile.ativo) return null;

    const perfil = profile.perfil ?? perfilFromAuth;
    return {
      nome: profile.nome,
      perfil,
      equipeId: profile.equipe_id,
      equipeNome: profile.equipe_nome,
      paginasAcesso: resolvePaginasAcesso(perfil, profile.paginas_acesso),
      ativo: profile.ativo,
    };
  }

  if (canManageOperacao(perfilFromAuth)) {
    return {
      nome: nomeFromAuth(authUser),
      perfil: perfilFromAuth,
      equipeId: null,
      equipeNome: null,
      paginasAcesso: resolvePaginasAcesso(perfilFromAuth, null),
      ativo: true,
    };
  }

  return null;
}
