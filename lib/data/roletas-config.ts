import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
import type { RoletasConfigData } from "@/lib/types/roletas";

export type { RoletasConfigCorretor, RoletasConfigData, RoletasConfigRoleta } from "@/lib/types/roletas";

const roletaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  disponiveis: z.number().int().nonnegative(),
});

const corretorSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string(),
  roletas: z.array(z.string().uuid()),
  status: z.enum(["liberado", "auditoria", "bloqueado"]),
});

const configSchema = z.object({
  equipe_nome: z.string(),
  roletas: z.array(roletaSchema),
  corretores: z.array(corretorSchema),
  gerado_em: z.string(),
});

export function getEmptyRoletasConfig(): RoletasConfigData {
  return {
    equipe_nome: "Equipe",
    roletas: [],
    corretores: [],
    gerado_em: new Date().toISOString(),
  };
}

export async function getRoletasConfigData(): Promise<RoletasConfigData> {
  if (!hasSupabaseEnv()) return getEmptyRoletasConfig();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_config_roletas");

  if (!error && data) {
    return configSchema.parse(data);
  }

  if (isMissingRpc(error, "obter_config_roletas")) {
    return getEmptyRoletasConfig();
  }

  throw new Error(`Não foi possível carregar as roletas: ${error?.message ?? "erro desconhecido"}`);
}
