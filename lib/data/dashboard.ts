import "server-only";

import { z } from "zod";
import type { PerfilUsuario } from "@/lib/database.types";
import { canManageOperacao, getViewerContext, mapPerfil, type ViewerContext } from "@/lib/auth/viewer-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";

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

function shouldUseAdminFallback(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return isMissingRpc(error, "obter_dashboard") || Boolean(error.message?.includes("perfil_atual"));
}

function inViewerScope(viewer: ViewerContext, equipeId: string | null) {
  if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
  return equipeId === viewer.equipeId;
}

async function loadPerfilByUserId(admin: ReturnType<typeof createAdminClient>) {
  const perfilByUserId = new Map<string, PerfilUsuario>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      perfilByUserId.set(user.id, mapPerfil(String(user.app_metadata?.perfil ?? "corretor")));
    }
    if (data.users.length < 1000) break;
  }
  return perfilByUserId;
}

async function loadDashboardFromTables(viewer: ViewerContext, days: number): Promise<DashboardData> {
  const admin = createAdminClient();
  const periodoDias = Math.max(1, Math.min(days, 90));
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - (periodoDias - 1));
  const inicioIso = inicio.toISOString();

  const [usuariosResult, oportunidadesResult, bloqueiosResult, auditoriasResult, capturasResult, perfilByUserId] = await Promise.all([
    admin.from("usuarios").select("id, nome, equipe_id, ativo, perfil").eq("ativo", true),
    admin.from("oportunidades").select("id, status, captada_em, ultima_atualizacao_bitrix, corretor_id"),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin.from("auditorias").select("corretor_id, status, data, concluida_em"),
    admin.from("capturas_diarias").select("corretor_id, quantidade_captada, limite_do_dia, data"),
    loadPerfilByUserId(admin),
  ]);

  const usuarios = (usuariosResult.data ?? [])
    .map((usuario) => ({
      ...usuario,
      perfil: usuario.perfil ?? perfilByUserId.get(usuario.id) ?? "corretor",
    }))
    .filter((usuario) => usuario.perfil === "corretor" && inViewerScope(viewer, usuario.equipe_id));

  const usuarioIds = new Set(usuarios.map((usuario) => usuario.id));
  const oportunidades = (oportunidadesResult.data ?? []).filter((item) => !item.corretor_id || usuarioIds.has(item.corretor_id));

  const disponiveis = oportunidades.filter((item) => item.status === "disponivel").length;
  const captadasPeriodo = oportunidades.filter((item) => item.captada_em && item.captada_em >= inicioIso).length;
  const trabalhadasPeriodo = oportunidades.filter(
    (item) => item.ultima_atualizacao_bitrix
      && item.ultima_atualizacao_bitrix >= inicioIso
      && ["em_trabalho", "convertida", "perdida"].includes(item.status),
  ).length;

  const bloqueados = new Set(
    (bloqueiosResult.data ?? [])
      .map((item) => item.corretor_id)
      .filter((corretorId) => usuarioIds.has(corretorId)),
  );

  const emAuditoria = new Set(
    (auditoriasResult.data ?? [])
      .filter((item) => item.status === "pendente" && usuarioIds.has(item.corretor_id))
      .map((item) => item.corretor_id),
  );

  const auditoriasConcluidas = (auditoriasResult.data ?? []).filter(
    (item) => item.concluida_em && item.concluida_em >= inicioIso && usuarioIds.has(item.corretor_id),
  );
  const tempoMedio = auditoriasConcluidas.length
    ? auditoriasConcluidas.reduce((total, item) => {
      const inicioAuditoria = new Date(item.data).getTime();
      const fimAuditoria = new Date(item.concluida_em!).getTime();
      return total + (fimAuditoria - inicioAuditoria) / 3_600_000;
    }, 0) / auditoriasConcluidas.length
    : 0;

  const hoje = new Date().toISOString().slice(0, 10);
  const capturasHoje = new Map(
    (capturasResult.data ?? [])
      .filter((item) => item.data === hoje)
      .map((item) => [item.corretor_id, item]),
  );

  const serie = Array.from({ length: periodoDias }, (_, index) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + index);
    const chave = dia.toISOString().slice(0, 10);
    const captadas = oportunidades.filter((item) => item.captada_em?.slice(0, 10) === chave).length;
    const trabalhadas = oportunidades.filter(
      (item) => item.ultima_atualizacao_bitrix?.slice(0, 10) === chave
        && ["em_trabalho", "convertida", "perdida"].includes(item.status),
    ).length;
    return { data: chave, captadas, trabalhadas };
  });

  const capacidade = usuarios.map((usuario) => {
    const captura = capturasHoje.get(usuario.id);
    const capturados = captura?.quantidade_captada ?? 0;
    const limite = captura?.limite_do_dia ?? 6;
    const status = bloqueados.has(usuario.id)
      ? "bloqueado"
      : emAuditoria.has(usuario.id)
        ? "auditoria"
        : "liberado";
    return { id: usuario.id, nome: usuario.nome, capturados, limite, status };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return dashboardSchema.parse({
    disponiveis,
    captadas_periodo: captadasPeriodo,
    trabalhadas_periodo: trabalhadasPeriodo,
    taxa_tratamento: captadasPeriodo === 0 ? 0 : Math.round((trabalhadasPeriodo / captadasPeriodo) * 1000) / 10,
    tempo_medio_auditoria_horas: Math.round(tempoMedio * 10) / 10,
    bloqueados: bloqueados.size,
    corretores_ativos: usuarios.length,
    periodo_dias: periodoDias,
    gerado_em: new Date().toISOString(),
    serie,
    capacidade,
  });
}

export async function getDashboardData(days = 7): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return dashboardSchema.parse({
      disponiveis: 0,
      captadas_periodo: 0,
      trabalhadas_periodo: 0,
      taxa_tratamento: 0,
      tempo_medio_auditoria_horas: 0,
      bloqueados: 0,
      corretores_ativos: 0,
      periodo_dias: days,
      gerado_em: new Date().toISOString(),
      serie: [],
      capacidade: [],
    });
  }

  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    throw new Error("Não foi possível carregar o dashboard: perfil sem permissão.");
  }

  if (hasSupabaseSecretKey() && viewer) {
    return loadDashboardFromTables(viewer, days);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_dashboard", { p_dias: days });

  if (!error && data) {
    return dashboardSchema.parse(data);
  }

  if (shouldUseAdminFallback(error) && viewer) {
    return loadDashboardFromTables(viewer, days);
  }

  throw new Error(`Não foi possível carregar o dashboard: ${error?.message ?? "erro desconhecido"}`);
}
