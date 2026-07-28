import "server-only";

import { z } from "zod";
import type { PerfilUsuario } from "@/lib/database.types";
import { canManageOperacao, getViewerContext, mapPerfil, type ViewerContext } from "@/lib/auth/viewer-context";
import { isOportunidadeDisponivel } from "@/lib/data/oportunidade-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, hasSupabaseSecretKey } from "@/lib/supabase/env";
import { isMissingRpc } from "@/lib/supabase/rpc";
import type { RoletasConfigData } from "@/lib/types/roletas";

export type { RoletasConfigCorretor, RoletasConfigData, RoletasConfigRoleta } from "@/lib/types/roletas";

const ROLETA_COMERCIAL_GERAL_FOCUS = "Comercial Geral · Focus";

function isRoletaCaptura(roleta: { nome: string; bitrix_funil_id?: string | null }) {
  if (roleta.nome === ROLETA_COMERCIAL_GERAL_FOCUS) return false;
  if (roleta.bitrix_funil_id?.endsWith(":dashboard")) return false;
  return true;
}

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

const configSchema = z.object({
  equipe_nome: z.string(),
  roletas: z.array(roletaSchema),
  corretores: z.array(corretorSchema),
  gerado_em: z.string(),
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
    roletas: [],
    corretores: [],
    gerado_em: new Date().toISOString(),
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

async function loadRoletasConfigFromTables(viewer: ViewerContext): Promise<RoletasConfigData> {
  const admin = createAdminClient();

  const [roletasResult, usuarios, perfilByUserId, atribuicoesResult, bloqueiosResult, auditoriasResult, oportunidadesResult] =
    await Promise.all([
      admin.from("roletas").select("id, nome, bitrix_funil_id").eq("ativa", true).order("nome"),
      loadUsuariosAtivos(admin),
      loadPerfilByUserId(admin),
      admin.from("roletas_corretor").select("corretor_id, roleta_id"),
      admin.from("bloqueios").select("corretor_id").is("liberado_em", null),
      admin.from("auditorias").select("corretor_id").eq("status", "pendente"),
      admin.from("oportunidades").select("roleta_id, corretor_id, captada_em"),
    ]);

  if (roletasResult.error) {
    throw new Error(`Não foi possível carregar as roletas: ${roletasResult.error.message}`);
  }

  const disponiveisPorRoleta = new Map<string, number>();
  for (const oportunidade of oportunidadesResult.data ?? []) {
    if (!isOportunidadeDisponivel(oportunidade)) continue;
    disponiveisPorRoleta.set(
      oportunidade.roleta_id,
      (disponiveisPorRoleta.get(oportunidade.roleta_id) ?? 0) + 1,
    );
  }

  const roletasPorCorretor = new Map<string, string[]>();
  for (const atribuicao of atribuicoesResult.data ?? []) {
    const atual = roletasPorCorretor.get(atribuicao.corretor_id) ?? [];
    atual.push(atribuicao.roleta_id);
    roletasPorCorretor.set(atribuicao.corretor_id, atual);
  }

  const bloqueados = new Set((bloqueiosResult.data ?? []).map((item) => item.corretor_id));
  const emAuditoria = new Set((auditoriasResult.data ?? []).map((item) => item.corretor_id));

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

  const roletasCaptura = (roletasResult.data ?? []).filter(isRoletaCaptura);
  const excludedRoletaIds = new Set(
    (roletasResult.data ?? [])
      .filter((roleta) => !isRoletaCaptura(roleta))
      .map((roleta) => roleta.id),
  );

  return configSchema.parse({
    equipe_nome: equipeNome,
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
  });
}

export async function getRoletasConfigData(): Promise<RoletasConfigData> {
  if (!hasSupabaseEnv()) return getEmptyRoletasConfig();

  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return getEmptyRoletasConfig();
  }

  if (hasSupabaseSecretKey() && viewer) {
    return loadRoletasConfigFromTables(viewer);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obter_config_roletas");

  if (!error && data) {
    const parsed = configSchema.safeParse(data);
    if (parsed.success) return withoutOperationalRoletas(parsed.data);
  }

  if (isMissingRpc(error, "obter_config_roletas")) {
    return getEmptyRoletasConfig();
  }

  throw new Error(`Não foi possível carregar as roletas: ${error?.message ?? "erro desconhecido"}`);
}
