import "server-only";

import type { AcessoListItem, AcessoManagementData, EquipeOption } from "@/lib/types/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";

function emptyData(loadError: string | null = null): AcessoManagementData {
  return { usuarios: [], equipes: [], loadError };
}

function mapUsuarios(rows: Array<{
  id: string;
  nome: string;
  email: string;
  perfil: AcessoListItem["perfil"];
  equipe_id: string | null;
  equipe_nome: string | null;
  bitrix_user_id: string | null;
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
    ativo: user.ativo,
  }));
}

function mapEquipes(rows: Array<{ id: string; nome: string }>): EquipeOption[] {
  return rows.map((equipe) => ({ id: equipe.id, nome: equipe.nome }));
}

export async function getAcessoManagementData(): Promise<AcessoManagementData> {
  if (!hasSupabaseEnv()) {
    return emptyData("Supabase não configurado. Defina as variáveis em .env.local.");
  }

  try {
    if (hasSupabaseSecretKey()) {
      const admin = createAdminClient();
      const [usuariosResult, equipesResult] = await Promise.all([
        admin
          .from("usuarios")
          .select("id, nome, email, perfil, equipe_id, equipe_nome, bitrix_user_id, ativo")
          .order("nome"),
        admin.from("equipes").select("id, nome").order("nome"),
      ]);

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
    const [usuariosResult, equipesResult] = await Promise.all([
      supabase
        .from("usuarios")
        .select("id, nome, email, perfil, equipe_id, equipe_nome, bitrix_user_id, ativo")
        .order("nome"),
      supabase.from("equipes").select("id, nome").order("nome"),
    ]);

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
