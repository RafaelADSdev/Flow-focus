import "server-only";

import { bitrixCall, hasBitrixEnv } from "@/lib/bitrix/client";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

/**
 * Atualiza no Supabase os negócios capturados dos corretores na fila,
 * para a auditoria refletir contato/etapa reais do Bitrix24.
 */
export async function refreshCapturedDealsForCorretores(corretorIds: string[]) {
  if (!hasBitrixEnv() || !corretorIds.length) return;

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: oportunidades, error } = await admin
    .from("oportunidades")
    .select("id, bitrix_deal_id, corretor_id, captada_em")
    .in("corretor_id", corretorIds)
    .not("captada_em", "is", null)
    .gte("captada_em", `${today}T00:00:00`);

  if (error || !oportunidades?.length) return;

  for (const oportunidade of oportunidades) {
    const dealId = String(oportunidade.bitrix_deal_id ?? "").trim();
    if (!dealId) continue;

    try {
      const deal = await bitrixCall<JsonRecord>("crm.deal.get", new URLSearchParams({ ID: dealId }));
      if (!deal) continue;

      const patch = {
        bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
        bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
        ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
        titulo: String(deal.TITLE ?? "") || undefined,
        valor: Number(deal.OPPORTUNITY ?? 0),
      };

      let { error: updateError } = await admin
        .from("oportunidades")
        .update({
          ...patch,
          status: (() => {
            const semantic = String(deal.STAGE_SEMANTIC_ID ?? "");
            if (semantic === "S") return "convertida";
            if (semantic === "F") return "perdida";
            return "em_trabalho";
          })(),
        } as never)
        .eq("id", oportunidade.id);

      if (updateError?.message?.includes("status")) {
        const { status: _status, ...withoutStatus } = {
          ...patch,
          status: "em_trabalho",
        };
        ({ error: updateError } = await admin
          .from("oportunidades")
          .update(withoutStatus as never)
          .eq("id", oportunidade.id));
      }
      if (updateError) {
        // segue para o próximo negócio
      }
    } catch {
      // Bitrix indisponível para um deal não derruba a fila inteira
    }
  }
}
