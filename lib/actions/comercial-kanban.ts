"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageOperacao } from "@/lib/auth/perfil";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { bitrixCall, bitrixCallJson, hasBitrixEnv } from "@/lib/bitrix/client";
import { getBitrixBrokerField } from "@/lib/bitrix/broker-field";
import { fetchBitrixDealStages, stripStageSemanticSuffix } from "@/lib/bitrix/deal-stages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const moveSchema = z.object({
  opportunityId: z.string().uuid(),
  stageId: z.string().min(1),
});
const transferSchema = z.object({
  opportunityIds: z.array(z.string().uuid()).min(1).max(50),
  brokerId: z.string().uuid(),
});

export type MoveKanbanResult = { ok: true } | { ok: false; error: string };

export async function moveComercialKanbanCard(input: unknown): Promise<MoveKanbanResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimentação inválida." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Faça login novamente para mover o negócio." };

  const profile = await loadAuthProfile(authData.user);
  if (!profile || !canManageOperacao(profile.perfil) || !profile.paginasAcesso.includes("/comercial-geral")) {
    return { ok: false, error: "Seu perfil não pode movimentar esta esteira." };
  }

  const admin = createAdminClient();
  const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
  if (!hasBitrixEnv()) {
    return { ok: false, error: "O Bitrix24 está indisponível para movimentações." };
  }
  const stages = await fetchBitrixDealStages(categoryId).catch(() => []);
  const target = stages.find((stage) => stage.id === parsed.data.stageId);
  if (!target) return { ok: false, error: "A fase escolhida não pertence ao Comercial Geral." };

  const { data: opportunity, error } = await admin
    .from("oportunidades")
    .select("id, bitrix_deal_id, corretor_id, bitrix_stage_id")
    .eq("id", parsed.data.opportunityId)
    .maybeSingle();
  if (error || !opportunity) return { ok: false, error: "Negócio não encontrado." };
  const currentStageId = stripStageSemanticSuffix(opportunity.bitrix_stage_id);
  if (!currentStageId.startsWith(`C${categoryId}:`)) {
    return { ok: false, error: "Este negócio não pertence ao Comercial Geral." };
  }

  if (profile.perfil === "lider") {
    const { data: broker } = await admin
      .from("usuarios")
      .select("equipe_id")
      .eq("id", opportunity.corretor_id ?? "")
      .maybeSingle();
    if (!profile.equipeId || broker?.equipe_id !== profile.equipeId) {
      return { ok: false, error: "Este negócio está fora da sua equipe." };
    }
  }

  try {
    await bitrixCallJson("crm.item.update", {
      entityTypeId: 2,
      id: Number(opportunity.bitrix_deal_id),
      fields: { categoryId: Number(categoryId), stageId: target.id },
    });

    const status = target.semantics === "S"
      ? "convertida"
      : target.semantics === "F"
        ? "perdida"
        : "em_trabalho";
    const now = new Date().toISOString();
    const stageWithSemantic = target.semantics ? `${target.id}#${target.semantics}` : target.id;
    const { error: updateError } = await admin
      .from("oportunidades")
      .update({ bitrix_stage_id: stageWithSemantic, status, ultima_atualizacao_bitrix: now } as never)
      .eq("id", opportunity.id);
    if (updateError) {
      try {
        await bitrixCallJson("crm.item.update", {
          entityTypeId: 2,
          id: Number(opportunity.bitrix_deal_id),
          fields: { categoryId: Number(categoryId), stageId: currentStageId },
        });
      } catch {
        await admin.from("logs_auditoria").insert({
          usuario_id: authData.user.id,
          acao: "sincronizacao_local_falhou",
          entidade: "oportunidade",
          entidade_id: opportunity.id,
          payload: { fase_bitrix: stageWithSemantic, erro: updateError.message },
        });
        return { ok: true };
      }
      throw updateError;
    }

    await admin.from("logs_auditoria").insert({
      usuario_id: authData.user.id,
      acao: "mover_fase_comercial_geral",
      entidade: "oportunidade",
      entidade_id: opportunity.id,
      payload: { de: opportunity.bitrix_stage_id, para: stageWithSemantic },
    });
  } catch (moveError) {
    return {
      ok: false,
      error: moveError instanceof Error ? moveError.message : "Não foi possível mover o negócio.",
    };
  }

  revalidatePath("/comercial-geral");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type TransferKanbanResult =
  | { ok: true; movedIds: string[]; warning?: string }
  | { ok: false; error: string };

export async function transferComercialKanbanCards(input: unknown): Promise<TransferKanbanResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Transferência inválida." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { ok: false, error: "Faça login novamente para transferir negócios." };
  const profile = await loadAuthProfile(authData.user);
  if (!profile || !canManageOperacao(profile.perfil) || !profile.paginasAcesso.includes("/comercial-geral")) {
    return { ok: false, error: "Seu perfil não pode transferir negócios nesta esteira." };
  }
  if (!hasBitrixEnv()) return { ok: false, error: "O Bitrix24 está indisponível para transferências." };

  const admin = createAdminClient();
  const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
  const { data: targetBroker } = await admin
    .from("usuarios")
    .select("id, nome, equipe_id, bitrix_user_id, ativo")
    .eq("id", parsed.data.brokerId)
    .maybeSingle();
  if (!targetBroker?.ativo || !targetBroker.bitrix_user_id) {
    return { ok: false, error: "O corretor escolhido não está vinculado ao Bitrix24." };
  }
  if (profile.perfil === "lider" && targetBroker.equipe_id !== profile.equipeId) {
    return { ok: false, error: "Escolha um corretor da sua equipe." };
  }

  const { data: opportunities, error } = await admin
    .from("oportunidades")
    .select("id, bitrix_deal_id, corretor_id, bitrix_assigned_by_id, bitrix_stage_id")
    .in("id", parsed.data.opportunityIds);
  if (error || !opportunities || opportunities.length !== parsed.data.opportunityIds.length) {
    return { ok: false, error: "Um ou mais negócios não foram encontrados." };
  }
  if (opportunities.some((item) => !stripStageSemanticSuffix(item.bitrix_stage_id).startsWith(`C${categoryId}:`))) {
    return { ok: false, error: "A seleção contém um negócio fora do Comercial Geral." };
  }

  if (profile.perfil === "lider") {
    const currentBrokerIds = [...new Set(opportunities.map((item) => item.corretor_id).filter(Boolean))] as string[];
    const { data: currentBrokers } = await admin.from("usuarios").select("id, equipe_id").in("id", currentBrokerIds);
    if ((currentBrokers ?? []).some((broker) => broker.equipe_id !== profile.equipeId)) {
      return { ok: false, error: "A seleção contém um negócio fora da sua equipe." };
    }
  }

  const movedIds: string[] = [];
  const brokerField = getBitrixBrokerField();
  for (const opportunity of opportunities) {
    try {
      await bitrixCall<boolean>("crm.deal.update", new URLSearchParams({
        id: opportunity.bitrix_deal_id,
        "fields[ASSIGNED_BY_ID]": targetBroker.bitrix_user_id,
        [`fields[${brokerField}]`]: targetBroker.bitrix_user_id,
      }));
      const { error: updateError } = await admin
        .from("oportunidades")
        .update({ corretor_id: targetBroker.id, bitrix_assigned_by_id: targetBroker.bitrix_user_id } as never)
        .eq("id", opportunity.id);
      if (updateError) {
        const previousBitrixId = opportunity.bitrix_assigned_by_id;
        if (previousBitrixId) {
          await bitrixCall<boolean>("crm.deal.update", new URLSearchParams({
            id: opportunity.bitrix_deal_id,
            "fields[ASSIGNED_BY_ID]": previousBitrixId,
            [`fields[${brokerField}]`]: previousBitrixId,
          }));
        }
        throw updateError;
      }
      movedIds.push(opportunity.id);
      await admin.from("logs_auditoria").insert({
        usuario_id: authData.user.id,
        acao: "transferir_comercial_geral",
        entidade: "oportunidade",
        entidade_id: opportunity.id,
        payload: { de: opportunity.corretor_id, para: targetBroker.id },
      });
    } catch (transferError) {
      return movedIds.length
        ? { ok: true, movedIds, warning: `${movedIds.length} negócio(s) transferido(s); a operação foi interrompida: ${transferError instanceof Error ? transferError.message : "erro no Bitrix24"}` }
        : { ok: false, error: transferError instanceof Error ? transferError.message : "Não foi possível transferir os negócios." };
    }
  }

  revalidatePath("/comercial-geral");
  revalidatePath("/dashboard");
  return { ok: true, movedIds };
}
