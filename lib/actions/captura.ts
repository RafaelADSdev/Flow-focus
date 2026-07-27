"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assignDealToCorretor } from "@/lib/bitrix/assign-deal";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { isOportunidadeDisponivel } from "@/lib/data/oportunidade-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

const payloadSchema = z.object({
  roletaId: z.string().uuid(),
});

type ActionResult =
  | { ok: true; titulo: string; bitrixDealId: string }
  | { ok: false; error: string; code?: string };

function captureErrorMessage(code: string) {
  switch (code) {
    case "corretor_bloqueado":
      return "Sua captação está bloqueada. Aguarde a liberação da liderança.";
    case "limite_diario_atingido":
      return "Você atingiu o limite diário de capturas.";
    case "roleta_sem_oportunidades":
      return "Não há oportunidades disponíveis nesta roleta agora.";
    case "roleta_nao_autorizada":
      return "Você não tem permissão para captar nesta roleta.";
    case "perfil_sem_permissao":
      return "Seu perfil não pode captar oportunidades.";
    case "bitrix_nao_vinculado":
      return "Seu usuário ainda não está vinculado ao Bitrix24. Peça à liderança para sincronizar o acesso.";
    case "bitrix_atribuicao_falhou":
      return "A oportunidade foi reservada, mas não foi possível atribuí-la a você no Bitrix24. Tente novamente.";
    default:
      return "Não foi possível captar a oportunidade. Tente novamente.";
  }
}

async function syncCapturedDealInBitrix(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    oportunidadeId: string;
    bitrixDealId: string;
    bitrixUserId: string;
  },
) {
  const assignment = await assignDealToCorretor(input.bitrixDealId, input.bitrixUserId);

  const { error } = await admin
    .from("oportunidades")
    .update({
      bitrix_assigned_by_id: assignment.assignedById,
      bitrix_stage_id: assignment.stageId,
    } as never)
    .eq("id", input.oportunidadeId);

  if (error) {
    throw new Error(error.message);
  }
}

async function rollbackCapture(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    oportunidadeId: string;
    userId: string;
    today: string;
    previousCapturados: number;
    hadCapturaRow: boolean;
  },
) {
  let { error } = await admin
    .from("oportunidades")
    .update({ corretor_id: null, captada_em: null, status: "disponivel" } as never)
    .eq("id", input.oportunidadeId);

  if (error?.message?.includes("status")) {
    ({ error } = await admin
      .from("oportunidades")
      .update({ corretor_id: null, captada_em: null } as never)
      .eq("id", input.oportunidadeId));
  }

  if (error) return;

  if (input.hadCapturaRow) {
    if (input.previousCapturados > 0) {
      await admin
        .from("capturas_diarias")
        .update({ quantidade_captada: input.previousCapturados })
        .eq("corretor_id", input.userId)
        .eq("data", input.today);
    } else {
      await admin
        .from("capturas_diarias")
        .delete()
        .eq("corretor_id", input.userId)
        .eq("data", input.today);
    }
  }
}

export async function captarOportunidade(input: unknown): Promise<ActionResult> {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Roleta inválida." };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    return { ok: false, error: "Faça login novamente para captar oportunidades.", code: "nao_autenticado" };
  }

  const profile = await loadAuthProfile(authUser);
  if (!profile || profile.perfil !== "corretor" || !profile.ativo) {
    return { ok: false, error: captureErrorMessage("perfil_sem_permissao"), code: "perfil_sem_permissao" };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "Captura indisponível no servidor." };
  }

  const admin = createAdminClient();
  const userId = authUser.id;
  const roletaId = parsed.data.roletaId;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: corretor }, { data: bloqueio }, { data: autorizado }, { data: capturaAtual }] = await Promise.all([
    admin.from("usuarios").select("bitrix_user_id").eq("id", userId).single(),
    admin.from("bloqueios").select("id").eq("corretor_id", userId).is("liberado_em", null).maybeSingle(),
    admin.from("roletas_corretor").select("roleta_id").eq("corretor_id", userId).eq("roleta_id", roletaId).maybeSingle(),
    admin.from("capturas_diarias").select("quantidade_captada, limite_do_dia").eq("corretor_id", userId).eq("data", today).maybeSingle(),
  ]);

  if (!corretor?.bitrix_user_id) {
    return { ok: false, error: captureErrorMessage("bitrix_nao_vinculado"), code: "bitrix_nao_vinculado" };
  }

  if (bloqueio) {
    return { ok: false, error: captureErrorMessage("corretor_bloqueado"), code: "corretor_bloqueado" };
  }
  if (!autorizado) {
    return { ok: false, error: captureErrorMessage("roleta_nao_autorizada"), code: "roleta_nao_autorizada" };
  }

  const capturados = capturaAtual?.quantidade_captada ?? 0;
  const limite = capturaAtual?.limite_do_dia ?? 6;
  if (capturados >= limite) {
    return { ok: false, error: captureErrorMessage("limite_diario_atingido"), code: "limite_diario_atingido" };
  }

  const { data: candidatas, error: candidatasError } = await admin
    .from("oportunidades")
    .select("id, titulo, bitrix_deal_id, corretor_id, captada_em, roleta_id")
    .eq("roleta_id", roletaId)
    .is("corretor_id", null)
    .is("captada_em", null)
    .order("criado_em", { ascending: true })
    .limit(1);

  if (candidatasError) {
    return { ok: false, error: candidatasError.message };
  }

  const oportunidade = (candidatas ?? []).find((item) => isOportunidadeDisponivel(item));
  if (!oportunidade) {
    return { ok: false, error: captureErrorMessage("roleta_sem_oportunidades"), code: "roleta_sem_oportunidades" };
  }

  const capturadoEm = new Date().toISOString();
  const baseUpdate = {
    corretor_id: userId,
    captada_em: capturadoEm,
  };

  let { error: updateError } = await admin
    .from("oportunidades")
    .update({ ...baseUpdate, status: "captada" } as never)
    .eq("id", oportunidade.id)
    .is("corretor_id", null);

  if (updateError?.message?.includes("status")) {
    ({ error: updateError } = await admin
      .from("oportunidades")
      .update(baseUpdate as never)
      .eq("id", oportunidade.id)
      .is("corretor_id", null));
  }

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  if (capturaAtual) {
    await admin
      .from("capturas_diarias")
      .update({ quantidade_captada: capturados + 1 })
      .eq("corretor_id", userId)
      .eq("data", today);
  } else {
    await admin.from("capturas_diarias").insert({
      corretor_id: userId,
      data: today,
      quantidade_captada: 1,
      limite_do_dia: limite,
    });
  }

  if (hasBitrixEnv()) {
    try {
      await syncCapturedDealInBitrix(admin, {
        oportunidadeId: oportunidade.id,
        bitrixDealId: oportunidade.bitrix_deal_id,
        bitrixUserId: corretor.bitrix_user_id,
      });
    } catch {
      await rollbackCapture(admin, {
        oportunidadeId: oportunidade.id,
        userId,
        today,
        previousCapturados: capturados,
        hadCapturaRow: Boolean(capturaAtual),
      });
      return { ok: false, error: captureErrorMessage("bitrix_atribuicao_falhou"), code: "bitrix_atribuicao_falhou" };
    }
  }

  const novaQuantidade = capturados + 1;
  try {
    const { ensurePendingAuditoriaForCorretor } = await import("@/lib/data/auditorias");
    await ensurePendingAuditoriaForCorretor(admin, userId);
  } catch {
    // A captura já foi concluída; a fila de auditoria tenta reconciliar no próximo carregamento.
  }

  revalidatePath("/corretor");
  revalidatePath("/auditorias");
  return {
    ok: true,
    titulo: String(oportunidade.titulo ?? "Oportunidade captada"),
    bitrixDealId: String(oportunidade.bitrix_deal_id ?? ""),
  };
}
