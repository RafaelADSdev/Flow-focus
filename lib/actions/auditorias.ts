"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

const leadChecklistSchema = z.object({
  oportunidadeId: z.string().uuid(),
  tentativaContato: z.boolean(),
  comentarioBitrix: z.boolean(),
  etapaAtualizada: z.boolean(),
});

const saveSchema = z.object({
  auditoriaId: z.string().uuid(),
  observacoes: z.string().trim().max(1500),
  leads: z.array(leadChecklistSchema).min(1).max(6),
});

type ActionResult =
  | { ok: true; vagasLiberadas: number; leadsPendentes: number }
  | { ok: false; error: string };

function parseRpcResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const vagasLiberadas = Number(row.vagas_liberadas ?? 0);
  const leadsPendentes = Number(row.leads_pendentes ?? 0);
  if (!Number.isInteger(vagasLiberadas) || !Number.isInteger(leadsPendentes)) return null;
  return { vagasLiberadas, leadsPendentes };
}

export async function salvarChecklistAuditoriaAction(input: unknown): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Checklist inválido." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }

  const viewer = await getViewerContext();
  if (!viewer || !canManageOperacao(viewer.perfil)) {
    return { ok: false, error: "Seu perfil não pode concluir auditorias." };
  }

  const admin = createAdminClient();
  const { data: auditoria, error: auditoriaError } = await admin
    .from("auditorias")
    .select("id, corretor_id, status")
    .eq("id", parsed.data.auditoriaId)
    .maybeSingle();

  if (auditoriaError || !auditoria || auditoria.status !== "pendente") {
    return { ok: false, error: "Esta auditoria não está mais disponível." };
  }

  if (viewer.perfil === "lider") {
    const { data: corretor } = await admin
      .from("usuarios")
      .select("equipe_id")
      .eq("id", auditoria.corretor_id)
      .maybeSingle();
    if (!corretor || corretor.equipe_id !== viewer.equipeId) {
      return { ok: false, error: "Você só pode auditar corretores da sua equipe." };
    }
  }

  const { data, error } = await admin.rpc("salvar_checklist_auditoria", {
    p_auditoria_id: parsed.data.auditoriaId,
    p_lider_id: viewer.userId,
    p_leads: parsed.data.leads,
    p_observacoes: parsed.data.observacoes || null,
  });

  if (error) {
    if (error.message.includes("lead_auditoria_indisponivel")) {
      return { ok: false, error: "Um dos leads já foi auditado. Atualize a fila e tente novamente." };
    }
    return { ok: false, error: error.message };
  }

  const result = parseRpcResult(data);
  if (!result) return { ok: false, error: "A auditoria foi salva, mas o retorno não pôde ser confirmado." };

  revalidatePath("/auditorias");
  revalidatePath("/corretor");
  revalidatePath("/dashboard");
  revalidatePath("/roletas");
  revalidatePath("/resultados");

  return { ok: true, ...result };
}
