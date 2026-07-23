import "server-only";

import type { PerfilUsuario } from "@/lib/database.types";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { canManageOperacao, mapPerfil } from "@/lib/auth/perfil";
import { createClient } from "@/lib/supabase/server";

export type ViewerContext = {
  userId: string;
  perfil: PerfilUsuario;
  equipeId: string | null;
  equipeNome: string | null;
};

export { canManageOperacao, mapPerfil };

export async function getViewerContext(): Promise<ViewerContext | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return null;

  const profile = await loadAuthProfile(authUser);
  if (!profile) return null;

  return {
    userId: authUser.id,
    perfil: profile.perfil,
    equipeId: profile.equipeId,
    equipeNome: profile.equipeNome,
  };
}
