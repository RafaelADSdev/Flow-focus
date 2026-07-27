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

type AuditoriaRow = {
  id: string;
  corretor_id: string;
  status?: string | null;
  data: string;
  concluida_em: string | null;
};

type UsuarioRow = {
  id: string;
  nome: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  ativo: boolean;
  perfil: string | null;
};

function isMissingColumn(error: { message?: string } | null | undefined, column: string) {
  return Boolean(error?.message?.includes(column));
}

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

function isPendente(auditoria: AuditoriaRow) {
  if (auditoria.status) return auditoria.status === "pendente";
  return !auditoria.concluida_em;
}

function isAprovado(auditoria: AuditoriaRow) {
  if (auditoria.status) return auditoria.status === "aprovado";
  return Boolean(auditoria.concluida_em);
}

async function listAuditorias(admin: ReturnType<typeof createAdminClient>) {
  const withStatus = await admin
    .from("auditorias")
    .select("id, corretor_id, status, data, concluida_em");

  if (isMissingColumn(withStatus.error, "status")) {
    const fallback = await admin
      .from("auditorias")
      .select("id, corretor_id, data, concluida_em");
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []) as AuditoriaRow[];
  }

  if (withStatus.error) throw new Error(withStatus.error.message);
  return (withStatus.data ?? []) as AuditoriaRow[];
}

async function listOportunidadesResumo(admin: ReturnType<typeof createAdminClient>) {
  const withStatus = await admin
    .from("oportunidades")
    .select("corretor_id, captada_em, status, ultima_atualizacao_bitrix");

  if (isMissingColumn(withStatus.error, "status")) {
    const fallback = await admin
      .from("oportunidades")
      .select("corretor_id, captada_em, ultima_atualizacao_bitrix");
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  if (withStatus.error) throw new Error(withStatus.error.message);
  return withStatus.data ?? [];
}

function oportunidadeAtualizada(oportunidade: {
  captada_em: string | null;
  status?: string | null;
  ultima_atualizacao_bitrix?: string | null;
}) {
  if (oportunidade.status && ["em_trabalho", "convertida", "perdida"].includes(oportunidade.status)) {
    return true;
  }
  if (!oportunidade.captada_em || !oportunidade.ultima_atualizacao_bitrix) return false;
  return oportunidade.ultima_atualizacao_bitrix > oportunidade.captada_em;
}

async function resolveLiderId(
  admin: ReturnType<typeof createAdminClient>,
  equipeId: string | null,
  fallbackUserId: string,
) {
  if (equipeId) {
    const { data: equipe } = await admin.from("equipes").select("lider_id").eq("id", equipeId).maybeSingle();
    if (equipe?.lider_id) return equipe.lider_id;
  }

  const { data: adminUser } = await admin
    .from("usuarios")
    .select("id")
    .eq("perfil", "admin")
    .eq("ativo", true)
    .order("nome")
    .limit(1)
    .maybeSingle();

  return adminUser?.id ?? fallbackUserId;
}

export async function ensurePendingAuditoriaForCorretor(
  admin: ReturnType<typeof createAdminClient>,
  corretorId: string,
) {
  const existing = await listAuditorias(admin);
  if (existing.some((item) => item.corretor_id === corretorId && isPendente(item))) {
    return;
  }

  const { data: usuario, error: usuarioError } = await admin
    .from("usuarios")
    .select("id, equipe_id")
    .eq("id", corretorId)
    .maybeSingle();
  if (usuarioError || !usuario) return;

  const liderId = await resolveLiderId(admin, usuario.equipe_id, corretorId);
  const payload = {
    corretor_id: corretorId,
    lider_id: liderId,
    data: new Date().toISOString(),
    observacoes: null,
    criterios_avaliados: [],
  };

  let { error } = await admin.from("auditorias").insert({ ...payload, status: "pendente" } as never);
  if (isMissingColumn(error, "status")) {
    ({ error } = await admin.from("auditorias").insert(payload as never));
  }
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw new Error(error.message);
  }
}

async function ensurePendingAuditoriasFromCapturas(admin: ReturnType<typeof createAdminClient>) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: capturas, error } = await admin
    .from("capturas_diarias")
    .select("corretor_id, quantidade_captada")
    .eq("data", today);
  if (error) throw new Error(error.message);

  const emAndamento = (capturas ?? []).filter((item) => (item.quantidade_captada ?? 0) > 0);

  for (const item of emAndamento) {
    await ensurePendingAuditoriaForCorretor(admin, item.corretor_id);
  }
}

async function loadAuditoriasFromTables(viewer: ViewerContext): Promise<AuditoriasPainelData> {
  const admin = createAdminClient();
  await ensurePendingAuditoriasFromCapturas(admin);

  const inicioSemana = startOfWeek().toISOString();
  const inicioSemanaAnterior = new Date(startOfWeek());
  inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);
  const inicioSemanaAnteriorIso = inicioSemanaAnterior.toISOString();
  const hoje = new Date().toISOString().slice(0, 10);

  const [usuariosResult, bloqueiosResult, capturasResult, auditorias] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, equipe_nome, ativo, perfil").eq("ativo", true),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin.from("capturas_diarias").select("corretor_id, quantidade_captada, data"),
    listAuditorias(admin),
  ]);

  if (usuariosResult.error) throw new Error(usuariosResult.error.message);
  if (bloqueiosResult.error) throw new Error(bloqueiosResult.error.message);
  if (capturasResult.error) throw new Error(capturasResult.error.message);

  const usuarios = new Map(
    ((usuariosResult.data ?? []) as UsuarioRow[]).map((usuario) => [usuario.id, {
      ...usuario,
      perfil: usuario.perfil ?? "corretor",
    }]),
  );

  const scopedAuditorias = auditorias.filter((auditoria) => {
    const usuario = usuarios.get(auditoria.corretor_id);
    return usuario && inViewerScope(viewer, usuario.equipe_id);
  });

  const pendentes = scopedAuditorias.filter(isPendente);
  const corretorIdsPendentes = [...new Set(pendentes.map((item) => item.corretor_id))];

  if (corretorIdsPendentes.length) {
    const { refreshCapturedDealsForCorretores } = await import("@/lib/bitrix/refresh-captured-deals");
    await refreshCapturedDealsForCorretores(corretorIdsPendentes);
  }

  const oportunidades = await listOportunidadesResumo(admin);
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

  const oportunidadesPorCorretor = new Map<string, { atualizados: number; ultimaCaptura: string | null; capturadosHoje: number }>();
  for (const oportunidade of oportunidades) {
    if (!oportunidade.corretor_id || !oportunidade.captada_em) continue;
    const atual = oportunidadesPorCorretor.get(oportunidade.corretor_id) ?? {
      atualizados: 0,
      ultimaCaptura: null,
      capturadosHoje: 0,
    };
    if (oportunidade.captada_em.slice(0, 10) === hoje) {
      atual.capturadosHoje += 1;
      if (oportunidadeAtualizada(oportunidade)) atual.atualizados += 1;
    }
    if (!atual.ultimaCaptura || oportunidade.captada_em > atual.ultimaCaptura) {
      atual.ultimaCaptura = oportunidade.captada_em;
    }
    oportunidadesPorCorretor.set(oportunidade.corretor_id, atual);
  }

  const aprovadasSemana = scopedAuditorias.filter(
    (item) => isAprovado(item) && item.concluida_em && item.concluida_em >= inicioSemana,
  );

  const tempoMedio = (items: AuditoriaRow[]) => {
    const concluidas = items.filter((item) => item.concluida_em);
    if (!concluidas.length) return 0;
    const total = concluidas.reduce((sum, item) => {
      const inicio = new Date(item.data).getTime();
      const fim = new Date(item.concluida_em!).getTime();
      return sum + (fim - inicio) / 3_600_000;
    }, 0);
    return Math.round((total / concluidas.length) * 10) / 10;
  };

  const tempoAtual = tempoMedio(scopedAuditorias.filter((item) => item.concluida_em && item.concluida_em >= inicioSemana));
  const tempoAnterior = tempoMedio(
    scopedAuditorias.filter(
      (item) => item.concluida_em
        && item.concluida_em >= inicioSemanaAnteriorIso
        && item.concluida_em < inicioSemana,
    ),
  );

  const fila = pendentes.map((auditoria) => {
    const usuario = usuarios.get(auditoria.corretor_id)!;
    const capturados = capturasHoje.get(auditoria.corretor_id)
      ?? oportunidadesPorCorretor.get(auditoria.corretor_id)?.capturadosHoje
      ?? 0;
    const resumo = oportunidadesPorCorretor.get(auditoria.corretor_id) ?? {
      atualizados: 0,
      ultimaCaptura: null,
      capturadosHoje: 0,
    };
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
    try {
      return await loadAuditoriasFromTables(viewer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      throw new Error(`Não foi possível carregar as auditorias: ${message}`);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_painel_auditorias");

  if (!error && data) {
    return painelSchema.parse(data);
  }

  if (shouldUseAdminFallback(error) && viewer && hasSupabaseSecretKey()) {
    return loadAuditoriasFromTables(viewer);
  }

  if (isMissingRpc(error, "obter_painel_auditorias")) {
    return getEmptyAuditoriasPainel();
  }

  throw new Error(`Não foi possível carregar as auditorias: ${error?.message ?? "erro desconhecido"}`);
}
