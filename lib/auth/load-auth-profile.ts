import "server-only";

import type { User } from "@supabase/supabase-js";
import type { PerfilUsuario } from "@/lib/database.types";
import {
  resolvePaginasAcesso,
  type PaginaAcesso,
} from "@/lib/auth/paginas-acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import { canManageOperacao, mapPerfil } from "@/lib/auth/perfil";
import { fetchBitrixUserPhotos } from "@/lib/bitrix/fetch-user-photos";
import { resolveUserDisplayName } from "@/lib/bitrix/user-display-name";

export type LoadedAuthProfile = {
  nome: string;
  perfil: PerfilUsuario;
  equipeId: string | null;
  equipeNome: string | null;
  paginasAcesso: PaginaAcesso[];
  ativo: boolean;
  fotoUrl: string | null;
};

function nomeFromAuth(authUser: User): string {
  return resolveUserDisplayName({
    existingName: typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome : null,
    email: authUser.email ?? "usuario",
  });
}

type UsuarioProfileRow = {
  nome: string;
  perfil: PerfilUsuario | null;
  equipe_id: string | null;
  equipe_nome: string | null;
  paginas_acesso?: string[] | null;
  ativo: boolean;
  foto_url?: string | null;
  bitrix_user_id?: string | null;
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

  const withPages = await query("nome, perfil, equipe_id, equipe_nome, paginas_acesso, ativo, foto_url, bitrix_user_id");
  if (withPages.error?.message?.includes("foto_url") || withPages.error?.message?.includes("bitrix_user_id")) {
    const fallback = await query("nome, perfil, equipe_id, equipe_nome, paginas_acesso, ativo");
    if (fallback.error?.message?.includes("paginas_acesso")) {
      const base = await query("nome, perfil, equipe_id, equipe_nome, ativo");
      return {
        data: (base.data as UsuarioProfileRow | null) ?? null,
        error: base.error,
      };
    }
    return {
      data: (fallback.data as UsuarioProfileRow | null) ?? null,
      error: fallback.error,
    };
  }
  if (withPages.error?.message?.includes("paginas_acesso")) {
    const fallback = await query("nome, perfil, equipe_id, equipe_nome, ativo, foto_url, bitrix_user_id");
    if (fallback.error?.message?.includes("foto_url") || fallback.error?.message?.includes("bitrix_user_id")) {
      const base = await query("nome, perfil, equipe_id, equipe_nome, ativo");
      return {
        data: (base.data as UsuarioProfileRow | null) ?? null,
        error: base.error,
      };
    }
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

async function resolveProfilePhoto(profile: UsuarioProfileRow) {
  const cachedPhoto = profile.foto_url?.trim() || null;
  if (cachedPhoto) return cachedPhoto;
  const bitrixUserId = profile.bitrix_user_id?.trim();
  if (!bitrixUserId) return null;
  const photos = await fetchBitrixUserPhotos([bitrixUserId]);
  return photos.get(bitrixUserId) ?? null;
}

export async function loadAuthProfile(authUser: User): Promise<LoadedAuthProfile | null> {
  const perfilFromAuth = mapPerfil(String(authUser.app_metadata?.perfil ?? ""));
  const { data: profile, error } = await readUsuarioProfile(authUser);

  if (!error && profile) {
    if (!profile.ativo) return null;

    const perfil = profile.perfil ?? perfilFromAuth;
    const fotoUrl = await resolveProfilePhoto(profile);
    return {
      nome: profile.nome,
      perfil,
      equipeId: profile.equipe_id,
      equipeNome: profile.equipe_nome,
      paginasAcesso: resolvePaginasAcesso(perfil, profile.paginas_acesso),
      ativo: profile.ativo,
      fotoUrl,
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
      fotoUrl: null,
    };
  }

  return null;
}
