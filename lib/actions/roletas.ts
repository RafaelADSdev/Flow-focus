"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { getBolsaoSyncDefaults } from "@/lib/bitrix/bolsao-roleta";
import { syncBitrixDeals } from "@/lib/bitrix/sync-deals";
import { reconcileBolsaoRoletas } from "@/lib/bitrix/upsert-bolsao-roleta";
import { getUnavailableRoletaFailure } from "@/lib/roletas/config-state";
import { diffRoletaIds, sameRoletaIds } from "@/lib/roletas/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";
import type { RoletasPermissionReceipt } from "@/lib/types/roletas";

const payloadSchema = z.object({
  atribuicoes: z.array(z.object({
    corretorId: z.string().uuid(),
    roletaIds: z.array(z.string().uuid()),
    roletaIdsAntes: z.array(z.string().uuid()),
  })),
  contexto: z.object({
    tipo: z.literal("replicacao_equipe"),
    origemCorretorId: z.string().uuid(),
    equipe: z.string().trim().min(1).max(160),
    destinos: z.number().int().nonnegative(),
  }).optional(),
});

type ActionResult =
  | { ok: true; receipt: RoletasPermissionReceipt; auditWarning?: string }
  | { ok: false; error: string; code?: "conflict" | "validation" | "partial" };

type SyncBolsaoResult =
  | { ok: true; importados: number; roletas: number; syncedAt: string }
  | { ok: false; error: string };

export async function sincronizarBolsaoBitrix(): Promise<SyncBolsaoResult> {
  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return { ok: false, error: "Seu perfil não pode sincronizar o bolsão." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "A integração de dados ainda não foi configurada. Fale com o administrador." };
  }

  if (!hasBitrixEnv()) {
    return { ok: false, error: "A integração com o Bitrix24 ainda não foi configurada." };
  }

  try {
    const admin = createAdminClient();
    const summary = await syncBitrixDeals();
    await reconcileBolsaoRoletas(admin);
    revalidatePath("/roletas");
    revalidatePath("/corretor");
    return {
      ok: true,
      importados: summary.importados,
      roletas: summary.roletas,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ok: false,
      error: "Não foi possível sincronizar o bolsão. Tente novamente em alguns instantes.",
    };
  }
}

export async function salvarPermissoesRoletas(input: unknown): Promise<ActionResult> {
  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return { ok: false, error: "Seu perfil não pode alterar permissões de roleta." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "A integração de dados ainda não foi configurada. Fale com o administrador." };
  }

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", error: "Dados inválidos para salvar as permissões." };
  }

  if (!parsed.data.atribuicoes.length) {
    return { ok: false, code: "validation", error: "Não há alterações pendentes para salvar." };
  }

  const uniqueCorretorIds = new Set(parsed.data.atribuicoes.map((item) => item.corretorId));
  if (uniqueCorretorIds.size !== parsed.data.atribuicoes.length) {
    return { ok: false, code: "validation", error: "O lote contém corretores duplicados." };
  }

  const admin = createAdminClient();
  const corretorIds = parsed.data.atribuicoes.map((item) => item.corretorId);
  const idsParaValidar = [...new Set([
    ...corretorIds,
    ...(parsed.data.contexto ? [parsed.data.contexto.origemCorretorId] : []),
  ])];

  const corretoresQuery = admin
    .from("usuarios")
    .select("id, equipe_id")
    .in("id", idsParaValidar)
    .eq("ativo", true);

  const { data: corretores, error: corretoresError } = await corretoresQuery;
  if (corretoresError) {
    return { ok: false, error: "Não foi possível validar os corretores." };
  }

  const corretoresPermitidos = new Set(
    (corretores ?? [])
      .filter((corretor) => {
        if (viewer?.perfil === "admin" || viewer?.perfil === "diretora") return true;
        return corretor.equipe_id === viewer?.equipeId;
      })
      .map((corretor) => corretor.id),
  );

  for (const atribuicao of parsed.data.atribuicoes) {
    if (!corretoresPermitidos.has(atribuicao.corretorId)) {
      return { ok: false, error: "Você não pode alterar corretores fora da sua equipe." };
    }
  }
  if (parsed.data.contexto && !corretoresPermitidos.has(parsed.data.contexto.origemCorretorId)) {
    return { ok: false, code: "validation", error: "O corretor modelo não pertence ao seu escopo atual." };
  }

  const { data: bloqueiosAtivos, error: bloqueiosError } = await admin
    .from("bloqueios")
    .select("corretor_id")
    .in("corretor_id", corretorIds)
    .is("liberado_em", null);
  if (bloqueiosError) {
    return { ok: false, error: "Não foi possível validar os bloqueios atuais." };
  }
  if (bloqueiosAtivos?.length) {
    return {
      ok: false,
      code: "conflict",
      error: "Um corretor foi bloqueado durante a edição. Atualize a página antes de salvar.",
    };
  }

  const { data: roletasGerenciaveis, error: roletasError } = await admin
    .from("roletas")
    .select("id")
    .eq("ativa", true)
    .eq("bitrix_category_id", getBolsaoSyncDefaults().categoryId);

  if (roletasError) {
    return { ok: false, error: "Não foi possível validar as roletas disponíveis." };
  }

  const roletaIdsGerenciaveis = new Set((roletasGerenciaveis ?? []).map((roleta) => roleta.id));
  const unavailableRoletaFailure = getUnavailableRoletaFailure(parsed.data.atribuicoes, roletaIdsGerenciaveis);
  if (unavailableRoletaFailure) return unavailableRoletaFailure;

  const atuaisQuery = admin
    .from("roletas_corretor")
    .select("corretor_id, roleta_id")
    .in("corretor_id", corretorIds);
  const { data: atuais, error: atuaisError } = roletaIdsGerenciaveis.size
    ? await atuaisQuery.in("roleta_id", [...roletaIdsGerenciaveis])
    : { data: [], error: null };

  if (atuaisError) {
    return { ok: false, error: "Não foi possível ler as permissões atuais." };
  }

  const atuaisPorCorretor = new Map<string, Set<string>>();
  for (const item of atuais ?? []) {
    const atual = atuaisPorCorretor.get(item.corretor_id) ?? new Set<string>();
    atual.add(item.roleta_id);
    atuaisPorCorretor.set(item.corretor_id, atual);
  }

  const changes = parsed.data.atribuicoes.map((atribuicao) => {
    const current = [...(atuaisPorCorretor.get(atribuicao.corretorId) ?? new Set<string>())];
    return {
      corretorId: atribuicao.corretorId,
      baseline: atribuicao.roletaIdsAntes,
      ...diffRoletaIds(current, atribuicao.roletaIds),
    };
  });

  const conflict = changes.find((change) => !sameRoletaIds(
    [...(atuaisPorCorretor.get(change.corretorId) ?? new Set<string>())],
    change.baseline,
  ));
  if (conflict) {
    return {
      ok: false,
      code: "conflict",
      error: "As permissões foram alteradas em outra sessão. Atualize a página para revisar antes de salvar.",
    };
  }

  const effectiveChanges = changes.filter((change) => change.added.length || change.removed.length);
  for (const change of effectiveChanges) {
    const { corretorId, added: toAdd, removed: toRemove } = change;

    if (toRemove.length) {
      const { error: deleteError } = await admin
        .from("roletas_corretor")
        .delete()
        .eq("corretor_id", corretorId)
        .in("roleta_id", toRemove);
      if (deleteError) {
        return {
          ok: false,
          code: "partial",
          error: "O lote não foi concluído. Atualize a página para conferir o estado antes de tentar novamente.",
        };
      }
    }

    if (toAdd.length) {
      const { error: insertError } = await admin.from("roletas_corretor").insert(
        toAdd.map((roletaId) => ({
          corretor_id: corretorId,
          roleta_id: roletaId,
          liberado_por: viewer!.userId,
        })),
      );
      if (insertError) {
        return {
          ok: false,
          code: "partial",
          error: "O lote não foi concluído. Atualize a página para conferir o estado antes de tentar novamente.",
        };
      }
    }
  }

  const added = effectiveChanges.reduce((total, change) => total + change.added.length, 0);
  const removed = effectiveChanges.reduce((total, change) => total + change.removed.length, 0);
  const permissionsChanged = added + removed;
  const actorResult = await admin.from("usuarios").select("nome").eq("id", viewer!.userId).maybeSingle();
  const actorName = actorResult.data?.nome ?? "Usuário autorizado";
  const registradoEm = new Date().toISOString();
  const logResult = await admin
    .from("logs_auditoria")
    .insert({
      usuario_id: viewer!.userId,
      acao: "permissoes_roletas_atualizadas",
      entidade: "roletas_corretor",
      payload: {
        corretores_alterados: effectiveChanges.length,
        permissoes_alteradas: permissionsChanged,
        adicionadas: added,
        removidas: removed,
        corretor_ids: effectiveChanges.map((change) => change.corretorId),
        contexto: parsed.data.contexto ?? { tipo: "edicao_manual" },
      },
    })
    .select("id, criado_em")
    .single();

  const receipt: RoletasPermissionReceipt = {
    id: logResult.data?.id ?? null,
    registradoEm: logResult.data?.criado_em ?? registradoEm,
    autorNome: actorName,
    corretoresAlterados: effectiveChanges.length,
    permissoesAlteradas: permissionsChanged,
    adicionadas: added,
    removidas: removed,
  };

  revalidatePath("/roletas");
  revalidatePath("/corretor");
  return {
    ok: true,
    receipt,
    ...(logResult.error
      ? { auditWarning: "As permissões foram salvas, mas o recibo de auditoria não pôde ser registrado." }
      : {}),
  };
}
