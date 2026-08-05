"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao, getViewerContext } from "@/lib/auth/viewer-context";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { updateDealLeadershipNote } from "@/lib/bitrix/lead-notes";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

const leadChecklistSchema = z.object({
  oportunidadeId: z.string().uuid(),
  tentativaContato: z.boolean(),
  comentarioBitrix: z.boolean(),
  etapaAtualizada: z.boolean(),
  observacao: z.string().trim().max(1500).default(""),
});

const saveSchema = z.object({
  auditoriaId: z.string().uuid(),
  leads: z.array(leadChecklistSchema).min(1).max(6),
});

type ChangedNote = {
  bitrixDealId: string;
  observacao: string;
};

type ActionResult =
  | { ok: true; vagasLiberadas: number; leadsPendentes: number; bitrixNaoSincronizados: string[] }
  | { ok: false; error: string };

function parseChangedNotes(value: unknown): ChangedNote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const bitrixDealId = typeof row.bitrix_deal_id === "string" ? row.bitrix_deal_id.trim() : "";
    if (!bitrixDealId) return [];
    return [{
      bitrixDealId,
      observacao: typeof row.observacao === "string" ? row.observacao : "",
    }];
  });
}

function parseRpcResult(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const vagasLiberadas = Number(row.vagas_liberadas ?? 0);
  const leadsPendentes = Number(row.leads_pendentes ?? 0);
  if (!Number.isInteger(vagasLiberadas) || !Number.isInteger(leadsPendentes)) return null;
  return {
    vagasLiberadas,
    leadsPendentes,
    notasAlteradas: parseChangedNotes(row.notas_alteradas),
  };
}

async function syncChangedNotesToBitrix(
  admin: ReturnType<typeof createAdminClient>,
  auditoriaId: string,
  liderId: string,
  notes: ChangedNote[],
) {
  if (!hasBitrixEnv() || !notes.length) return [] as string[];

  const failures: string[] = [];

  for (const note of notes) {
    try {
      await updateDealLeadershipNote(note.bitrixDealId, note.observacao);
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      console.error(`Falha ao sincronizar observação no Bitrix para o negócio ${note.bitrixDealId}:`, message);
      failures.push(note.bitrixDealId);
    }
  }

  if (failures.length) {
    const { error } = await admin.from("logs_auditoria").insert({
      usuario_id: liderId,
      acao: "observacao_bitrix_falhou",
      entidade: "auditoria",
      entidade_id: auditoriaId,
      payload: { bitrix_deal_ids: failures },
    } as never);
    if (error) console.error("Falha ao registrar log de sincronização Bitrix:", error.message);
  }

  return failures;
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
  });

  if (error) {
    if (error.message.includes("lead_auditoria_indisponivel")) {
      return { ok: false, error: "Um dos leads já foi auditado. Atualize a fila e tente novamente." };
    }
    return { ok: false, error: error.message };
  }

  const result = parseRpcResult(data);
  if (!result) return { ok: false, error: "A auditoria foi salva, mas o retorno não pôde ser confirmado." };

  const bitrixNaoSincronizados = await syncChangedNotesToBitrix(
    admin,
    parsed.data.auditoriaId,
    viewer.userId,
    result.notasAlteradas,
  );

  revalidatePath("/auditorias");
  revalidatePath("/corretor");
  revalidatePath("/dashboard");
  revalidatePath("/roletas");
  revalidatePath("/resultados");

  return { ok: true, vagasLiberadas: result.vagasLiberadas, leadsPendentes: result.leadsPendentes, bitrixNaoSincronizados };
}
