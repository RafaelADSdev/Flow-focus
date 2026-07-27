"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

const concludeSchema = z.object({
  auditoriaId: z.string().uuid(),
  approved: z.boolean(),
  observacoes: z.string().trim().max(1500),
  criterios: z.array(z.object({
    id: z.string(),
    atendido: z.boolean(),
  })).min(1),
});

type ActionResult = { ok: true } | { ok: false; error: string };

function isMissingColumn(error: { message?: string } | null | undefined, column: string) {
  return Boolean(error?.message?.includes(column));
}

export async function concluirAuditoriaAction(input: unknown): Promise<ActionResult> {
  const parsed = concludeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados da auditoria inválidos." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }

  const viewer = await getViewerContext();
  if (!viewer || !canManageOperacao(viewer.perfil)) {
    return { ok: false, error: "Seu perfil não pode concluir auditorias." };
  }

  const admin = createAdminClient();
  const { auditoriaId, approved, observacoes, criterios } = parsed.data;
  const status = approved ? "aprovado" : "reprovado";
  const concluidaEm = new Date().toISOString();

  let current: { id: string; corretor_id: string; concluida_em: string | null; status?: string | null } | null = null;

  const withStatus = await admin
    .from("auditorias")
    .select("id, corretor_id, concluida_em, status")
    .eq("id", auditoriaId)
    .maybeSingle();

  if (isMissingColumn(withStatus.error, "status")) {
    const fallback = await admin
      .from("auditorias")
      .select("id, corretor_id, concluida_em")
      .eq("id", auditoriaId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { ok: false, error: fallback.error?.message ?? "Auditoria não encontrada." };
    }
    current = fallback.data;
  } else if (withStatus.error || !withStatus.data) {
    return { ok: false, error: withStatus.error?.message ?? "Auditoria não encontrada." };
  } else {
    current = withStatus.data;
  }

  if (current.concluida_em || current.status === "aprovado" || current.status === "reprovado") {
    return { ok: false, error: "Esta auditoria já foi concluída." };
  }

  if (viewer.perfil === "lider") {
    const { data: corretor } = await admin
      .from("usuarios")
      .select("equipe_id")
      .eq("id", current.corretor_id)
      .maybeSingle();
    if (!corretor || corretor.equipe_id !== viewer.equipeId) {
      return { ok: false, error: "Você só pode auditar corretores da sua equipe." };
    }
  }

  const updateWithStatus = {
    status,
    observacoes: observacoes || null,
    criterios_avaliados: criterios,
    concluida_em: concluidaEm,
    lider_id: viewer.userId,
  };

  let { error: updateError } = await admin
    .from("auditorias")
    .update(updateWithStatus as never)
    .eq("id", auditoriaId);

  if (isMissingColumn(updateError, "status")) {
    const { status: _status, ...withoutStatus } = updateWithStatus;
    ({ error: updateError } = await admin
      .from("auditorias")
      .update(withoutStatus as never)
      .eq("id", auditoriaId));
  }

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (!approved) {
    await admin.from("bloqueios").insert({
      corretor_id: current.corretor_id,
      motivo: observacoes || "Carteira reprovada na auditoria",
    } as never);
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const { data: captura } = await admin
      .from("capturas_diarias")
      .select("quantidade_captada, limite_do_dia")
      .eq("corretor_id", current.corretor_id)
      .eq("data", today)
      .maybeSingle();

    // Só libera novo lote quando o limite do dia foi fechado.
    if ((captura?.quantidade_captada ?? 0) >= (captura?.limite_do_dia ?? 6)) {
      await admin
        .from("capturas_diarias")
        .update({ quantidade_captada: 0 })
        .eq("corretor_id", current.corretor_id)
        .eq("data", today);
    }
  }

  revalidatePath("/auditorias");
  revalidatePath("/corretor");
  revalidatePath("/dashboard");
  revalidatePath("/roletas");

  return { ok: true };
}
