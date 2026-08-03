import "server-only";

import { bitrixCall, hasBitrixEnv } from "@/lib/bitrix/client";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/** Atualiza os negócios capturados para auditoria e resultados refletirem o Bitrix24. */
export async function refreshCapturedDealsForCorretores(
  corretorIds: string[],
  options: { onlyPendingAudit?: boolean; opportunityIds?: string[] } = {},
) {
  if (!hasBitrixEnv() || !corretorIds.length || options.opportunityIds?.length === 0) return;

  const admin = createAdminClient();
  const oportunidades: Array<{ id: string; bitrix_deal_id: string; corretor_id: string | null; captada_em: string | null }> = [];

  for (let from = 0; ; from += 1000) {
    let query = admin
      .from("oportunidades")
      .select("id, bitrix_deal_id, corretor_id, captada_em")
      .in("corretor_id", corretorIds)
      .not("captada_em", "is", null)
      .order("captada_em", { ascending: false })
      .range(from, from + 999);
    if (options.opportunityIds) query = query.in("id", options.opportunityIds);
    if (options.onlyPendingAudit) query = query.is("auditoria_aprovada_em", null);
    const { data, error } = await query;
    if (error || !data?.length) break;
    oportunidades.push(...data);
    if (data.length < 1000) break;
  }

  const refreshOne = async (oportunidade: (typeof oportunidades)[number]) => {
    const dealId = String(oportunidade.bitrix_deal_id ?? "").trim();
    if (!dealId) return;

    try {
      const deal = await bitrixCall<JsonRecord>("crm.deal.get", new URLSearchParams({ ID: dealId }));
      if (!deal) return;

      const semantic = String(deal.STAGE_SEMANTIC_ID ?? "");
      const patch = {
        bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
        bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
        ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
        titulo: String(deal.TITLE ?? "") || undefined,
        valor: Number(deal.OPPORTUNITY ?? 0),
        status: semantic === "S" ? "convertida" : semantic === "F" ? "perdida" : "em_trabalho",
      };

      let { error: updateError } = await admin
        .from("oportunidades")
        .update(patch as never)
        .eq("id", oportunidade.id);

      if (updateError?.message.includes("status")) {
        const withoutStatus = {
          bitrix_stage_id: patch.bitrix_stage_id,
          bitrix_assigned_by_id: patch.bitrix_assigned_by_id,
          ultima_atualizacao_bitrix: patch.ultima_atualizacao_bitrix,
          titulo: patch.titulo,
          valor: patch.valor,
        };
        ({ error: updateError } = await admin.from("oportunidades").update(withoutStatus as never).eq("id", oportunidade.id));
      }
    } catch {
      // Uma falha pontual no Bitrix24 não interrompe os demais negócios.
    }
  };

  for (const batch of chunks(oportunidades, 6)) await Promise.all(batch.map(refreshOne));
}
