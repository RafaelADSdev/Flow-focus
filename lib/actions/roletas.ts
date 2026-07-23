"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

const payloadSchema = z.object({
  atribuicoes: z.array(z.object({
    corretorId: z.string().uuid(),
    roletaIds: z.array(z.string().uuid()),
  })),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function salvarPermissoesRoletas(input: unknown): Promise<ActionResult> {
  const viewer = await getViewerContext();
  if (!canManageOperacao(viewer?.perfil ?? null)) {
    return { ok: false, error: "Seu perfil não pode alterar permissões de roleta." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }

  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos para salvar as permissões." };
  }

  const admin = createAdminClient();
  const corretorIds = parsed.data.atribuicoes.map((item) => item.corretorId);

  let corretoresQuery = admin
    .from("usuarios")
    .select("id, equipe_id")
    .in("id", corretorIds)
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

  const { data: atuais, error: atuaisError } = await admin
    .from("roletas_corretor")
    .select("corretor_id, roleta_id")
    .in("corretor_id", corretorIds);

  if (atuaisError) {
    return { ok: false, error: "Não foi possível ler as permissões atuais." };
  }

  const atuaisPorCorretor = new Map<string, Set<string>>();
  for (const item of atuais ?? []) {
    const atual = atuaisPorCorretor.get(item.corretor_id) ?? new Set<string>();
    atual.add(item.roleta_id);
    atuaisPorCorretor.set(item.corretor_id, atual);
  }

  for (const atribuicao of parsed.data.atribuicoes) {
    const desired = new Set(atribuicao.roletaIds);
    const current = atuaisPorCorretor.get(atribuicao.corretorId) ?? new Set<string>();
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));

    if (toRemove.length) {
      const { error: deleteError } = await admin
        .from("roletas_corretor")
        .delete()
        .eq("corretor_id", atribuicao.corretorId)
        .in("roleta_id", toRemove);
      if (deleteError) {
        return { ok: false, error: "Não foi possível remover permissões antigas." };
      }
    }

    if (toAdd.length) {
      const { error: insertError } = await admin.from("roletas_corretor").insert(
        toAdd.map((roletaId) => ({
          corretor_id: atribuicao.corretorId,
          roleta_id: roletaId,
          liberado_por: viewer!.userId,
        })),
      );
      if (insertError) {
        return { ok: false, error: "Não foi possível salvar as novas permissões." };
      }
    }
  }

  revalidatePath("/roletas");
  return { ok: true };
}
