import "server-only";

import { z } from "zod";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { isOportunidadeDisponivel, mapOportunidadeStatus } from "@/lib/data/oportunidade-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
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

function shouldUseTableFallback(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return isMissingRpc(error, "obter_carteira")
    || Boolean(error.message?.includes("perfil_atual"))
    || Boolean(error.message?.includes("usuario_nao_encontrado"));
}

async function loadCarteiraFromTables(userId: string): Promise<CarteiraData> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    usuarioResult,
    capturaResult,
    bloqueioResult,
    auditoriaResult,
    atribuicoesResult,
    roletasResult,
    oportunidadesResult,
  ] = await Promise.all([
    admin.from("usuarios").select("nome, perfil, ativo").eq("id", userId).single(),
    admin.from("capturas_diarias").select("quantidade_captada, limite_do_dia").eq("corretor_id", userId).eq("data", today).maybeSingle(),
    admin.from("bloqueios").select("id").eq("corretor_id", userId).is("liberado_em", null).limit(1),
    admin.from("auditorias").select("id").eq("corretor_id", userId).eq("status", "pendente").limit(1),
    admin.from("roletas_corretor").select("roleta_id").eq("corretor_id", userId),
    admin.from("roletas").select("id, nome, descricao, ativa").eq("ativa", true).order("nome"),
    admin.from("oportunidades").select("id, bitrix_deal_id, titulo, valor, captada_em, corretor_id, roleta_id, ultima_atualizacao_bitrix, bitrix_stage_id, roleta_atual"),
  ]);

  if (usuarioResult.error || !usuarioResult.data?.ativo) {
    throw new Error("Não foi possível carregar a carteira do usuário.");
  }

  const capturados = capturaResult.data?.quantidade_captada ?? 0;
  const limite = capturaResult.data?.limite_do_dia ?? 6;
  const bloqueado = Boolean(bloqueioResult.data?.length);
  const auditoriaPendente = Boolean(auditoriaResult.data?.length);

  let estadoCiclo: CarteiraData["estado_ciclo"] = "captacao_liberada";
  if (bloqueado) estadoCiclo = "bloqueado";
  else if (auditoriaPendente || capturados >= limite) estadoCiclo = "auditoria_pendente";

  const roletaIds = new Set((atribuicoesResult.data ?? []).map((item) => item.roleta_id));
  const roletasAtivas = (roletasResult.data ?? []).filter((roleta) => roletaIds.has(roleta.id));
  const oportunidades = oportunidadesResult.data ?? [];
  const roletaNomePorId = new Map((roletasResult.data ?? []).map((roleta) => [roleta.id, roleta.nome]));

  const disponiveisPorRoleta = new Map<string, number>();
  for (const oportunidade of oportunidades) {
    if (!isOportunidadeDisponivel(oportunidade)) continue;
    disponiveisPorRoleta.set(
      oportunidade.roleta_id,
      (disponiveisPorRoleta.get(oportunidade.roleta_id) ?? 0) + 1,
    );
  }

  const capturasRecentes = oportunidades
    .filter((oportunidade) => oportunidade.corretor_id === userId && oportunidade.captada_em)
    .sort((a, b) => String(b.captada_em).localeCompare(String(a.captada_em)))
    .slice(0, 10)
    .map((oportunidade) => ({
      id: oportunidade.id,
      bitrix_deal_id: oportunidade.bitrix_deal_id,
      titulo: oportunidade.titulo ?? "Oportunidade sem título",
      roleta: roletaNomePorId.get(oportunidade.roleta_id) ?? "Roleta",
      captada_em: oportunidade.captada_em!,
      valor: Number(oportunidade.valor ?? 0),
      status: mapOportunidadeStatus(oportunidade),
    }));

  return carteiraSchema.parse({
    nome: usuarioResult.data.nome,
    perfil: usuarioResult.data.perfil ?? "corretor",
    capturados,
    limite,
    estado_ciclo: estadoCiclo,
    roletas: roletasAtivas.map((roleta) => ({
      id: roleta.id,
      nome: roleta.nome,
      descricao: roleta.descricao ?? "",
      disponiveis: disponiveisPorRoleta.get(roleta.id) ?? 0,
    })),
    capturas_recentes: capturasRecentes,
    gerado_em: new Date().toISOString(),
  });
}

export async function getCarteiraData(): Promise<CarteiraData> {
  if (!hasSupabaseEnv()) return getEmptyCarteira();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return getEmptyCarteira();

  const profile = await loadAuthProfile(authUser);
  if (!profile) return getEmptyCarteira();

  if (hasSupabaseSecretKey()) {
    try {
      return await loadCarteiraFromTables(authUser.id);
    } catch {
      // segue para RPC legado
    }
  }

  const { data, error } = await supabase.rpc("obter_carteira");
  if (!error && data) {
    return carteiraSchema.parse(data);
  }

  if (shouldUseTableFallback(error) && hasSupabaseSecretKey()) {
    return loadCarteiraFromTables(authUser.id);
  }

  return carteiraSchema.parse({
    ...getEmptyCarteira(profile.nome),
    perfil: profile.perfil,
  });
}
