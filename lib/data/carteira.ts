import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
import { getCurrentUser } from "@/lib/data/usuario-atual";
import type { CarteiraData } from "@/lib/types/carteira";

export type { CarteiraCaptura, CarteiraData, CarteiraRoleta } from "@/lib/types/carteira";

const roletaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  descricao: z.string(),
  disponiveis: z.number().int().nonnegative(),
});

const capturaSchema = z.object({
  id: z.string().uuid(),
  bitrix_deal_id: z.string(),
  titulo: z.string(),
  roleta: z.string(),
  captada_em: z.string(),
  valor: z.number().nonnegative(),
  status: z.enum(["disponivel", "captada", "em_trabalho", "convertida", "perdida"]),
});

const carteiraSchema = z.object({
  nome: z.string(),
  perfil: z.enum(["corretor", "lider", "diretora", "admin"]),
  capturados: z.number().int().nonnegative(),
  limite: z.number().int().positive(),
  estado_ciclo: z.enum(["captacao_liberada", "auditoria_pendente", "bloqueado"]),
  roletas: z.array(roletaSchema),
  capturas_recentes: z.array(capturaSchema),
  gerado_em: z.string(),
});

export function getEmptyCarteira(nome = "Corretor"): CarteiraData {
  return {
    nome,
    perfil: "corretor",
    capturados: 0,
    limite: 6,
    estado_ciclo: "captacao_liberada",
    roletas: [],
    capturas_recentes: [],
    gerado_em: new Date().toISOString(),
  };
}

function isMissingCarteiraRpc(error: { message?: string; code?: string } | null) {
  return isMissingRpc(error, "obter_carteira");
}

export async function getCarteiraData(): Promise<CarteiraData> {
  if (!hasSupabaseEnv()) return getEmptyCarteira();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_carteira");

  if (!error && data) {
    return carteiraSchema.parse(data);
  }

  if (isMissingCarteiraRpc(error)) {
    const user = await getCurrentUser();
    return {
      ...getEmptyCarteira(user.nome),
      perfil: user.perfil,
    };
  }

  throw new Error(`Não foi possível carregar a carteira: ${error?.message ?? "erro desconhecido"}`);
}
