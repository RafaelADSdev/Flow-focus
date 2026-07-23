import "server-only";

import { z } from "zod";
import { canManageOperacao, getViewerContext, type ViewerContext } from "@/lib/auth/viewer-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
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

function shouldUseAdminFallback(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return isMissingRpc(error, "obter_painel_auditorias") || Boolean(error.message?.includes("perfil_atual"));
}

function inViewerScope(viewer: ViewerContext, equipeId: string | null) {
  if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
  return equipeId === viewer.equipeId;
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

async function loadAuditoriasFromTables(viewer: ViewerContext): Promise<AuditoriasPainelData> {
  const admin = createAdminClient();
  const inicioSemana = startOfWeek().toISOString();
  const inicioSemanaAnterior = new Date(startOfWeek());
  inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);
  const inicioSemanaAnteriorIso = inicioSemanaAnterior.toISOString();
  const hoje = new Date().toISOString().slice(0, 10);

  const [usuariosResult, auditoriasResult, bloqueiosResult, capturasResult, oportunidadesResult] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome, ativo, perfil").eq("ativo", true),
    admin.from("auditorias").select("id, corretor_id, status, data, concluida_em"),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin.from("capturas_diarias").select("corretor_id, quantidade_captada, data"),
    admin.from("oportunidades").select("corretor_id, captada_em, status"),
  ]);

  const usuarios = new Map(
    (usuariosResult.data ?? []).map((usuario) => [usuario.id, {
      ...usuario,
      perfil: usuario.perfil ?? "corretor",
    }]),
  );

  const auditorias = (auditoriasResult.data ?? []).filter((auditoria) => {
    const usuario = usuarios.get(auditoria.corretor_id);
    return usuario && inViewerScope(viewer, usuario.equipe_id);
  });

  const bloqueados = new Set(
    (bloqueiosResult.data ?? [])
      .map((item) => item.corretor_id)
      .filter((corretorId) => {
        const usuario = usuarios.get(corretorId);
        return usuario && inViewerScope(viewer, usuario.equipe_id);
      }),
  );

  const capturasHoje = new Map(
    (capturasResult.data ?? [])
      .filter((item) => item.data === hoje)
      .map((item) => [item.corretor_id, item.quantidade_captada ?? 0]),
  );

  const oportunidadesPorCorretor = new Map<string, { atualizados: number; ultimaCaptura: string | null }>();
  for (const oportunidade of oportunidadesResult.data ?? []) {
    if (!oportunidade.corretor_id) continue;
    const atual = oportunidadesPorCorretor.get(oportunidade.corretor_id) ?? { atualizados: 0, ultimaCaptura: null };
    if (oportunidade.captada_em?.slice(0, 10) === hoje && ["em_trabalho", "convertida", "perdida"].includes(oportunidade.status)) {
      atual.atualizados += 1;
    }
    if (oportunidade.captada_em && (!atual.ultimaCaptura || oportunidade.captada_em > atual.ultimaCaptura)) {
      atual.ultimaCaptura = oportunidade.captada_em;
    }
    oportunidadesPorCorretor.set(oportunidade.corretor_id, atual);
  }

  const pendentes = auditorias.filter((item) => item.status === "pendente");
  const aprovadasSemana = auditorias.filter(
    (item) => item.status === "aprovado" && item.concluida_em && item.concluida_em >= inicioSemana,
  );

  const tempoMedio = (items: typeof auditorias) => {
    const concluidas = items.filter((item) => item.concluida_em);
    if (!concluidas.length) return 0;
    const total = concluidas.reduce((sum, item) => {
      const inicio = new Date(item.data).getTime();
      const fim = new Date(item.concluida_em!).getTime();
      return sum + (fim - inicio) / 3_600_000;
    }, 0);
    return Math.round((total / concluidas.length) * 10) / 10;
  };

  const tempoAtual = tempoMedio(auditorias.filter((item) => item.concluida_em && item.concluida_em >= inicioSemana));
  const tempoAnterior = tempoMedio(
    auditorias.filter(
      (item) => item.concluida_em
        && item.concluida_em >= inicioSemanaAnteriorIso
        && item.concluida_em < inicioSemana,
    ),
  );

  const fila = pendentes.map((auditoria) => {
    const usuario = usuarios.get(auditoria.corretor_id)!;
    const capturados = capturasHoje.get(auditoria.corretor_id) ?? 0;
    const resumo = oportunidadesPorCorretor.get(auditoria.corretor_id) ?? { atualizados: 0, ultimaCaptura: null };
    const esperaMinutos = Math.max(Math.floor((Date.now() - new Date(auditoria.data).getTime()) / 60_000), 0);
    return {
      id: auditoria.id,
      corretor_id: auditoria.corretor_id,
      corretor: usuario.nome,
      equipe: usuario.equipe_nome ?? "Sem equipe",
      capturados,
      atualizados: resumo.atualizados,
      sem_contato: Math.max(capturados - resumo.atualizados, 0),
      ultima_captura: resumo.ultimaCaptura,
      espera_minutos: esperaMinutos,
    };
  }).sort((a, b) => b.espera_minutos - a.espera_minutos);

  return painelSchema.parse({
    aguardando: pendentes.length,
    aprovadas_semana: aprovadasSemana.length,
    bloqueados: bloqueados.size,
    tempo_medio_horas: tempoAtual,
    tempo_medio_variacao_min: Math.round((tempoAnterior - tempoAtual) * 60),
    fila,
    gerado_em: new Date().toISOString(),
  });
}

export async function getAuditoriasPainelData(): Promise<AuditoriasPainelData> {
  if (!hasSupabaseEnv()) return getEmptyAuditoriasPainel();

  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return getEmptyAuditoriasPainel();
  }

  if (hasSupabaseSecretKey() && viewer) {
    return loadAuditoriasFromTables(viewer);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_painel_auditorias");

  if (!error && data) {
    return painelSchema.parse(data);
  }

  if (shouldUseAdminFallback(error) && viewer) {
    return loadAuditoriasFromTables(viewer);
  }

  if (isMissingRpc(error, "obter_painel_auditorias")) {
    return getEmptyAuditoriasPainel();
  }

  throw new Error(`Não foi possível carregar as auditorias: ${error?.message ?? "erro desconhecido"}`);
}
