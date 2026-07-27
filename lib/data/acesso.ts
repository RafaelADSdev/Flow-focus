import "server-only";

import { normalizePaginasAcesso } from "@/lib/auth/paginas-acesso";
import type { AcessoListItem, AcessoManagementData, EquipeOption } from "@/lib/types/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";

function emptyData(loadError: string | null = null): AcessoManagementData {
  return { usuarios: [], equipes: [], loadError };
}

function isMissingPaginasColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.includes("paginas_acesso"));
}

function mapUsuarios(rows: Array<{
  id: string;
  nome: string;
  email: string;
  perfil: AcessoListItem["perfil"];
  equipe_id: string | null;
  equipe_nome: string | null;
  bitrix_user_id: string | null;
  paginas_acesso?: string[] | null;
  ativo: boolean;
}>): AcessoListItem[] {
  return rows.map((user) => ({
    id: user.id,
    email: user.email,
    nome: user.nome,
    perfil: user.perfil,
    equipeId: user.equipe_id,
    equipeNome: user.equipe_nome,
    bitrixUserId: user.bitrix_user_id,
    paginasAcesso: normalizePaginasAcesso(user.perfil, user.paginas_acesso),
    ativo: user.ativo,
  }));
}

function mapEquipes(rows: Array<{ id: string; nome: string }>): EquipeOption[] {
  return rows.map((equipe) => ({ id: equipe.id, nome: equipe.nome }));
}

const usuarioSelectWithPages = "id, nome, email, perfil, equipe_id, equipe_nome, bitrix_user_id, paginas_acesso, ativo";
const usuarioSelectFallback = "id, nome, email, perfil, equipe_id, equipe_nome, bitrix_user_id, ativo";

async function loadUsuariosAndEquipes(
  client: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>,
) {
  const withPages = await client.from("usuarios").select(usuarioSelectWithPages).order("nome");
  const usuariosResult = isMissingPaginasColumn(withPages.error)
    ? await client.from("usuarios").select(usuarioSelectFallback).order("nome")
    : withPages;

  const equipesResult = await client.from("equipes").select("id, nome").order("nome");
  return { usuariosResult, equipesResult };
}

export async function getAcessoManagementData(): Promise<AcessoManagementData> {
  if (!hasSupabaseEnv()) {
    return emptyData("Supabase não configurado. Defina as variáveis em .env.local.");
  }

  try {
    if (hasSupabaseSecretKey()) {
      const admin = createAdminClient();
      const { usuariosResult, equipesResult } = await loadUsuariosAndEquipes(admin);

      if (usuariosResult.error || equipesResult.error) {
        return emptyData(usuariosResult.error?.message ?? equipesResult.error?.message ?? "Erro ao carregar dados.");
      }

      return {
        usuarios: mapUsuarios(usuariosResult.data ?? []),
        equipes: mapEquipes(equipesResult.data ?? []),
        loadError: null,
      };
    }

    const supabase = await createClient();
    const { usuariosResult, equipesResult } = await loadUsuariosAndEquipes(supabase);

    if (usuariosResult.error || equipesResult.error) {
      return emptyData(usuariosResult.error?.message ?? equipesResult.error?.message ?? "Erro ao carregar dados.");
    }

    return {
      usuarios: mapUsuarios(usuariosResult.data ?? []),
      equipes: mapEquipes(equipesResult.data ?? []),
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao carregar a gestão de acesso.";
    return emptyData(message);
  }
}
