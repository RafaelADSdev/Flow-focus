import "server-only";

import { z } from "zod";
import type { PerfilUsuario } from "@/lib/database.types";
import { canManageOperacao, getViewerContext, mapPerfil, type ViewerContext } from "@/lib/auth/viewer-context";
import { isOportunidadeDisponivel } from "@/lib/data/oportunidade-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
import { isRoletaCaptura, ROLETA_COMERCIAL_GERAL_FOCUS } from "@/lib/data/roleta-captura";
import type { RoletasConfigData } from "@/lib/types/roletas";

export type { RoletasConfigCorretor, RoletasConfigData, RoletasConfigRoleta } from "@/lib/types/roletas";

function withoutOperationalRoletas(data: RoletasConfigData): RoletasConfigData {
  const excluded = new Set(
    data.roletas
      .filter((roleta) => roleta.nome === ROLETA_COMERCIAL_GERAL_FOCUS)
      .map((roleta) => roleta.id),
  );
  if (!excluded.size) return data;

  return {
    ...data,
    roletas: data.roletas.filter((roleta) => !excluded.has(roleta.id)),
    corretores: data.corretores.map((corretor) => ({
      ...corretor,
      roletas: corretor.roletas.filter((roletaId) => !excluded.has(roletaId)),
    })),
  };
}

const roletaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  disponiveis: z.number().int().nonnegative(),
});

const corretorSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string(),
  equipeNome: z.string().nullable().optional().transform((value) => value ?? null),
  roletas: z.array(z.string().uuid()),
  status: z.enum(["liberado", "auditoria", "bloqueado"]),
});

const receiptSchema = z.object({
  id: z.string().uuid().nullable(),
  registradoEm: z.string(),
  autorNome: z.string(),
  corretoresAlterados: z.number().int().nonnegative(),
  permissoesAlteradas: z.number().int().nonnegative(),
  adicionadas: z.number().int().nonnegative(),
  removidas: z.number().int().nonnegative(),
});

const receiptPayloadSchema = z.object({
  corretores_alterados: z.number().int().nonnegative(),
  permissoes_alteradas: z.number().int().nonnegative(),
  adicionadas: z.number().int().nonnegative(),
  removidas: z.number().int().nonnegative(),
  corretor_ids: z.array(z.string().uuid()).optional(),
});

const configSchema = z.object({
  equipe_nome: z.string(),
  viewer_perfil: z.enum(["corretor", "lider", "diretora", "admin"]).optional(),
  roletas: z.array(roletaSchema),
  corretores: z.array(corretorSchema),
  gerado_em: z.string(),
  ultimo_recibo: receiptSchema.nullable().optional().transform((value) => value ?? null),
});

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  ativo: boolean;
  perfil?: PerfilUsuario | null;
};

export function getEmptyRoletasConfig(): RoletasConfigData {
  return {
    equipe_nome: "Equipe",
    viewer_perfil: "admin",
    roletas: [],
    corretores: [],
    gerado_em: new Date().toISOString(),
    ultimo_recibo: null,
  };
}

function isMissingPerfilColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("perfil"));
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

async function loadUsuariosAtivos(admin: ReturnType<typeof createAdminClient>) {
  const withPerfil = await admin
    .from("usuarios")
    .select("id, nome, email, perfil, equipe_id, equipe_nome, ativo")
    .eq("ativo", true)
    .order("nome");

  if (!withPerfil.error) {
    return withPerfil.data as UsuarioRow[];
  }

  if (!isMissingPerfilColumn(withPerfil.error)) {
    throw new Error(`Não foi possível carregar os corretores: ${withPerfil.error.message}`);
  }

  const withoutPerfil = await admin
    .from("usuarios")
    .select("id, nome, email, equipe_id, equipe_nome, ativo")
    .eq("ativo", true)
    .order("nome");

  if (withoutPerfil.error) {
    throw new Error(`Não foi possível carregar os corretores: ${withoutPerfil.error.message}`);
  }

  return (withoutPerfil.data ?? []) as UsuarioRow[];
}

async function loadDisponiveisPorRoleta(
  admin: ReturnType<typeof createAdminClient>,
  roletaIds: string[],
) {
  const disponiveisPorRoleta = new Map<string, number>();
  if (!roletaIds.length) return disponiveisPorRoleta;

  const { data, error } = await admin
    .from("oportunidades")
    .select("roleta_id, corretor_id, captada_em, status")
    .in("roleta_id", roletaIds)
    .is("corretor_id", null)
    .is("captada_em", null);

  if (error?.message.includes("status")) {
    const fallback = await admin
      .from("oportunidades")
      .select("roleta_id, corretor_id, captada_em")
      .in("roleta_id", roletaIds)
      .is("corretor_id", null)
      .is("captada_em", null);
    if (fallback.error) throw fallback.error;
    for (const oportunidade of fallback.data ?? []) {
      if (!isOportunidadeDisponivel(oportunidade)) continue;
      disponiveisPorRoleta.set(
        oportunidade.roleta_id,
        (disponiveisPorRoleta.get(oportunidade.roleta_id) ?? 0) + 1,
      );
    }
    return disponiveisPorRoleta;
  }

  if (error) throw error;

  for (const oportunidade of data ?? []) {
    if (!isOportunidadeDisponivel(oportunidade)) continue;
    disponiveisPorRoleta.set(
      oportunidade.roleta_id,
      (disponiveisPorRoleta.get(oportunidade.roleta_id) ?? 0) + 1,
    );
  }

  return disponiveisPorRoleta;
}

async function loadLatestPermissionReceipt(
  admin: ReturnType<typeof createAdminClient>,
  allowedCorretorIds: Set<string> | null,
) {
  const { data: logs, error } = await admin
    .from("logs_auditoria")
    .select("id, usuario_id, payload, criado_em")
    .eq("acao", "permissoes_roletas_atualizadas")
    .eq("entidade", "roletas_corretor")
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error || !logs?.length) return null;
  const log = allowedCorretorIds
    ? logs.find((item) => {
        const parsed = receiptPayloadSchema.safeParse(item.payload);
        return parsed.success && parsed.data.corretor_ids?.some((id) => allowedCorretorIds.has(id));
      })
    : logs[0];
  if (!log) return null;
  const payload = receiptPayloadSchema.safeParse(log.payload);
  if (!payload.success) return null;

  const actor = log.usuario_id
    ? await admin.from("usuarios").select("nome").eq("id", log.usuario_id).maybeSingle()
    : null;

  return receiptSchema.parse({
    id: log.id,
    registradoEm: log.criado_em,
    autorNome: actor?.data?.nome ?? "Usuário autorizado",
    corretoresAlterados: payload.data.corretores_alterados,
    permissoesAlteradas: payload.data.permissoes_alteradas,
    adicionadas: payload.data.adicionadas,
    removidas: payload.data.removidas,
  });
}

async function loadRoletasConfigFromTables(viewer: ViewerContext): Promise<RoletasConfigData> {
  const admin = createAdminClient();

  const [roletasResult, usuarios, atribuicoesResult, bloqueiosResult, capacidadeResult] = await Promise.all([
    admin.from("roletas").select("id, nome, bitrix_funil_id, bitrix_category_id").eq("ativa", true).order("nome"),
    loadUsuariosAtivos(admin),
    admin.from("roletas_corretor").select("corretor_id, roleta_id"),
    admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
    admin
      .from("oportunidades")
      .select("corretor_id")
      .not("corretor_id", "is", null)
      .not("captada_em", "is", null)
      .is("auditoria_aprovada_em", null),
  ]);

  if (roletasResult.error) {
    throw new Error(`Não foi possível carregar as roletas: ${roletasResult.error.message}`);
  }

  const roletasCaptura = (roletasResult.data ?? []).filter(isRoletaCaptura);
  const disponiveisPorRoleta = await loadDisponiveisPorRoleta(
    admin,
    roletasCaptura.map((roleta) => roleta.id),
  );

  const needsAuthPerfil = usuarios.some((usuario) => !usuario.perfil);
  const perfilByUserId = needsAuthPerfil ? await loadPerfilByUserId(admin) : new Map<string, PerfilUsuario>();

  const roletasPorCorretor = new Map<string, string[]>();
  for (const atribuicao of atribuicoesResult.data ?? []) {
    const atual = roletasPorCorretor.get(atribuicao.corretor_id) ?? [];
    atual.push(atribuicao.roleta_id);
    roletasPorCorretor.set(atribuicao.corretor_id, atual);
  }

  const bloqueados = new Set((bloqueiosResult.data ?? []).map((item) => item.corretor_id));
  const ativosPorCorretor = new Map<string, number>();
  for (const item of capacidadeResult.data ?? []) {
    if (!item.corretor_id) continue;
    ativosPorCorretor.set(item.corretor_id, (ativosPorCorretor.get(item.corretor_id) ?? 0) + 1);
  }
  const emAuditoria = new Set(
    [...ativosPorCorretor.entries()].filter(([, total]) => total >= 6).map(([corretorId]) => corretorId),
  );

  const corretores = usuarios
    .map((usuario) => ({
      ...usuario,
      perfil: usuario.perfil ?? perfilByUserId.get(usuario.id) ?? "corretor",
    }))
    .filter((usuario) => usuario.perfil === "corretor")
    .filter((corretor) => {
      if (viewer.perfil === "admin" || viewer.perfil === "diretora") return true;
      return corretor.equipe_id === viewer.equipeId;
    });

  const equipeNome =
    viewer.equipeNome
    ?? corretores.find((corretor) => corretor.equipe_nome)?.equipe_nome
    ?? "Equipe";
  const ultimoRecibo = await loadLatestPermissionReceipt(
    admin,
    viewer.perfil === "lider" ? new Set(corretores.map((corretor) => corretor.id)) : null,
  );

  const excludedRoletaIds = new Set(
    (roletasResult.data ?? [])
      .filter((roleta) => !isRoletaCaptura(roleta))
      .map((roleta) => roleta.id),
  );

  const parsed = configSchema.parse({
    equipe_nome: equipeNome,
    viewer_perfil: viewer.perfil,
    roletas: roletasCaptura.map((roleta) => ({
      id: roleta.id,
      nome: roleta.nome,
      disponiveis: disponiveisPorRoleta.get(roleta.id) ?? 0,
    })),
    corretores: corretores.map((corretor) => ({
      id: corretor.id,
      nome: corretor.nome,
      email: corretor.email,
      equipeNome: corretor.equipe_nome,
      roletas: (roletasPorCorretor.get(corretor.id) ?? []).filter((roletaId) => !excludedRoletaIds.has(roletaId)),
      status: bloqueados.has(corretor.id)
        ? "bloqueado"
        : emAuditoria.has(corretor.id)
          ? "auditoria"
          : "liberado",
    })),
    gerado_em: new Date().toISOString(),
    ultimo_recibo: ultimoRecibo,
  });
  return { ...parsed, viewer_perfil: parsed.viewer_perfil ?? viewer.perfil };
}

export async function getRoletasConfigData(): Promise<RoletasConfigData> {
  if (!hasSupabaseEnv()) return getEmptyRoletasConfig();

  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return getEmptyRoletasConfig();
  }

  if (hasSupabaseSecretKey() && viewer) {
    try {
      return await loadRoletasConfigFromTables(viewer);
    } catch {
      // segue para RPC legado
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_config_roletas");

  if (!error && data) {
    const parsed = configSchema.safeParse(data);
    if (parsed.success) {
      return withoutOperationalRoletas({
        ...parsed.data,
        viewer_perfil: parsed.data.viewer_perfil ?? viewer?.perfil ?? "admin",
      });
    }
  }

  if (isMissingRpc(error, "obter_config_roletas")) {
    return getEmptyRoletasConfig();
  }

  return getEmptyRoletasConfig();
}
