import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const dashboardSchema = z.object({
  disponiveis: z.number().int().nonnegative(),
  captadas_periodo: z.number().int().nonnegative(),
  trabalhadas_periodo: z.number().int().nonnegative(),
  taxa_tratamento: z.number().nonnegative(),
  tempo_medio_auditoria_horas: z.number().nonnegative(),
  bloqueados: z.number().int().nonnegative(),
  corretores_ativos: z.number().int().nonnegative(),
  periodo_dias: z.number().int().positive(),
  gerado_em: z.string(),
  serie: z.array(z.object({ data: z.string(), captadas: z.number().int().nonnegative(), trabalhadas: z.number().int().nonnegative() })),
  capacidade: z.array(z.object({
    id: z.string().uuid(), nome: z.string(), capturados: z.number().int().nonnegative(), limite: z.number().int().positive(),
    status: z.enum(["liberado", "auditoria", "bloqueado"]),
  })),
});

export type DashboardData = z.infer<typeof dashboardSchema>;

export async function getDashboardData(days = 7): Promise<DashboardData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_dashboard", { p_dias: days });
  if (error) throw new Error(`Nao foi possivel carregar o dashboard: ${error.message}`);
  return dashboardSchema.parse(data);
}
