import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, PerfilUsuario } from "@/lib/database.types";
import {
  resolvePaginasAcesso,
  type PaginaAcesso,
} from "@/lib/auth/paginas-acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import { canManageOperacao, mapPerfil } from "@/lib/auth/perfil";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { fetchBitrixUserPhotos } from "@/lib/bitrix/fetch-user-photos";
import { findBitrixUserByEmail, findBitrixUserById, type BitrixUserRecord } from "@/lib/bitrix/find-user";
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

function nomeFromAuth(authUser: User, bitrixUser?: BitrixUserRecord | null): string {
  return resolveUserDisplayName({
    bitrixUser,
    existingName: typeof authUser.user_metadata?.nome === "string" ? authUser.user_metadata.nome : null,
    email: authUser.email ?? "usuario",
  });
}

async function resolveBitrixUserForProfile(
  authUser: User,
  profile?: Pick<UsuarioProfileRow, "bitrix_user_id"> | null,
) {
  if (!hasBitrixEnv()) return null;

  const bitrixUserId = profile?.bitrix_user_id?.trim()
    || (typeof authUser.app_metadata?.bitrix_user_id === "string" ? authUser.app_metadata.bitrix_user_id.trim() : "");
  if (bitrixUserId) {
    try {
      const byId = await findBitrixUserById(bitrixUserId);
      if (byId) return byId;
    } catch {
      // segue para busca por e-mail
    }
  }

  const email = authUser.email?.trim().toLowerCase();
  if (!email) return null;

  try {
    return await findBitrixUserByEmail(email);
  } catch {
    return null;
  }
}

async function persistProfileIdentity(
  authUser: User,
  profile: UsuarioProfileRow,
  bitrixUser: BitrixUserRecord | null,
  nome: string,
  fotoUrl: string | null,
) {
  if (!hasSupabaseSecretKey()) return;

  const matchedBitrixUserId = String(bitrixUser?.ID ?? profile.bitrix_user_id ?? "").trim() || null;
  const shouldUpdateNome = nome !== profile.nome;
  const shouldUpdateBitrixId = matchedBitrixUserId && matchedBitrixUserId !== (profile.bitrix_user_id?.trim() || null);
  const shouldUpdatePhoto = fotoUrl && fotoUrl !== (profile.foto_url?.trim() || null);

  if (!shouldUpdateNome && !shouldUpdateBitrixId && !shouldUpdatePhoto) return;

  const admin = createAdminClient();
  const update: Database["public"]["Tables"]["usuarios"]["Update"] = {};
  if (shouldUpdateNome) update.nome = nome;
  if (shouldUpdateBitrixId) update.bitrix_user_id = matchedBitrixUserId;
  if (shouldUpdatePhoto) update.foto_url = fotoUrl;

  await admin.from("usuarios").update(update).eq("id", authUser.id);

  if (shouldUpdateNome) {
    await admin.auth.admin.updateUserById(authUser.id, {
      user_metadata: { ...authUser.user_metadata, nome },
    });
  }
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

async function resolveProfilePhoto(authUser: User, profile: UsuarioProfileRow, bitrixUser?: BitrixUserRecord | null) {
  const cachedPhoto = profile.foto_url?.trim() || null;
  const bitrixPhoto = String(bitrixUser?.PERSONAL_PHOTO ?? "").trim() || null;
  if (bitrixPhoto) return bitrixPhoto;
  if (cachedPhoto) return cachedPhoto;

  const bitrixUserId = String(bitrixUser?.ID ?? profile.bitrix_user_id ?? "").trim();
  if (bitrixUserId) {
    const photos = await fetchBitrixUserPhotos([bitrixUserId]);
    return photos.get(bitrixUserId) ?? null;
  }

  const email = authUser.email?.trim().toLowerCase();
  if (!email || !hasBitrixEnv()) return null;

  try {
    const resolvedUser = bitrixUser ?? await findBitrixUserByEmail(email);
    const matchedBitrixUserId = String(resolvedUser?.ID ?? "").trim() || null;
    const photoUrl = String(resolvedUser?.PERSONAL_PHOTO ?? "").trim() || null;
    if (!matchedBitrixUserId) return photoUrl;

    if (hasSupabaseSecretKey()) {
      const admin = createAdminClient();
      await admin
        .from("usuarios")
        .update({ bitrix_user_id: matchedBitrixUserId, foto_url: photoUrl })
        .eq("id", authUser.id);
    }

    return photoUrl;
  } catch {
    return null;
  }
}

export async function loadAuthProfile(authUser: User): Promise<LoadedAuthProfile | null> {
  const perfilFromAuth = mapPerfil(String(authUser.app_metadata?.perfil ?? ""));
  const { data: profile, error } = await readUsuarioProfile(authUser);

  if (!error && profile) {
    if (!profile.ativo) return null;

    const perfil = profile.perfil ?? perfilFromAuth;
    const bitrixUser = await resolveBitrixUserForProfile(authUser, profile);
    const nome = resolveUserDisplayName({
      bitrixUser,
      existingName: profile.nome,
      email: authUser.email ?? "usuario",
    });
    const fotoUrl = await resolveProfilePhoto(authUser, profile, bitrixUser);
    await persistProfileIdentity(authUser, profile, bitrixUser, nome, fotoUrl);
    return {
      nome,
      perfil,
      equipeId: profile.equipe_id,
      equipeNome: profile.equipe_nome,
      paginasAcesso: resolvePaginasAcesso(perfil, profile.paginas_acesso),
      ativo: profile.ativo,
      fotoUrl,
    };
  }

  if (canManageOperacao(perfilFromAuth)) {
    const bitrixUser = await resolveBitrixUserForProfile(authUser);
    return {
      nome: nomeFromAuth(authUser, bitrixUser),
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
