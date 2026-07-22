import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
import type { AuditoriasPainelData } from "@/lib/types/auditorias";

export type { AuditoriaFilaItem, AuditoriasPainelData } from "@/lib/types/auditorias";

const filaItemSchema = z.object({
  id: z.string().uuid(),
  corretor_id: z.string().uuid(),
  corretor: z.string(),
  equipe: z.string(),
  capturados: z.number().int().nonnegative(),
  atualizados: z.number().int().nonnegative(),
  sem_contato: z.number().int().nonnegative(),
  ultima_captura: z.string().nullable(),
  espera_minutos: z.number().int().nonnegative(),
});

const painelSchema = z.object({
  aguardando: z.number().int().nonnegative(),
  aprovadas_semana: z.number().int().nonnegative(),
  bloqueados: z.number().int().nonnegative(),
  tempo_medio_horas: z.number().nonnegative(),
  tempo_medio_variacao_min: z.number().int(),
  fila: z.array(filaItemSchema),
  gerado_em: z.string(),
});

export function getEmptyAuditoriasPainel(): AuditoriasPainelData {
  return {
    aguardando: 0,
    aprovadas_semana: 0,
    bloqueados: 0,
    tempo_medio_horas: 0,
    tempo_medio_variacao_min: 0,
    fila: [],
    gerado_em: new Date().toISOString(),
  };
}

export async function getAuditoriasPainelData(): Promise<AuditoriasPainelData> {
  if (!hasSupabaseEnv()) return getEmptyAuditoriasPainel();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_painel_auditorias");

  if (!error && data) {
    return painelSchema.parse(data);
  }

  if (isMissingRpc(error, "obter_painel_auditorias")) {
    return getEmptyAuditoriasPainel();
  }

  throw new Error(`Não foi possível carregar as auditorias: ${error?.message ?? "erro desconhecido"}`);
}
