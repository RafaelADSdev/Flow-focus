import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  buildBolsaoRoletaRow,
  canonicalRoletaAtualValue,
  getBolsaoSyncDefaults,
  type BolsaoRoletaConfig,
} from "@/lib/bitrix/bolsao-roleta";

type AdminClient = ReturnType<typeof createAdminClient>;

async function findRoletaByCanonical(
  admin: AdminClient,
  categoryId: string,
  canonical: string,
) {
  const { data, error } = await admin
    .from("roletas")
    .select("id, bitrix_roleta_valor")
    .eq("bitrix_category_id", categoryId);

  if (error) throw error;

  return (data ?? []).find(
    (item) => canonicalRoletaAtualValue(item.bitrix_roleta_valor ?? "") === canonical,
  );
}

export async function upsertBolsaoRoleta(
  admin: AdminClient,
  roletaAtual: string,
  config: BolsaoRoletaConfig,
): Promise<string> {
  const trimmed = roletaAtual.trim() || config.rouletteTag;
  const canonical = canonicalRoletaAtualValue(trimmed);
  const row = buildBolsaoRoletaRow(trimmed, config);
  const existing = await findRoletaByCanonical(admin, config.categoryId, canonical);

  if (existing) {
    const { data, error } = await admin
      .from("roletas")
      .update({
        nome: row.nome,
        bitrix_funil_id: row.bitrix_funil_id,
        bitrix_roleta_valor: row.bitrix_roleta_valor,
        descricao: row.descricao,
        ativa: true,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  const { data, error } = await admin
    .from("roletas")
    .upsert(row, { onConflict: "bitrix_funil_id" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function upsertBolsaoRoletasBatch(
  admin: AdminClient,
  roletaAtualValues: string[],
  config: BolsaoRoletaConfig,
): Promise<Map<string, string>> {
  const byCanonical = new Map<string, string>();

  for (const value of roletaAtualValues) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const canonical = canonicalRoletaAtualValue(trimmed);
    if (!byCanonical.has(canonical)) {
      byCanonical.set(canonical, trimmed);
    }
  }

  const map = new Map<string, string>();

  for (const display of byCanonical.values()) {
    const id = await upsertBolsaoRoleta(admin, display, config);
    map.set(display, id);
  }

  return map;
}

function isMonolithicBolsaoRoleta(roleta: {
  nome?: string | null;
  bitrix_funil_id?: string | null;
  bitrix_roleta_valor?: string | null;
}) {
  if (roleta.bitrix_funil_id === "36:C36:NEW:focus") return true;
  const nome = roleta.nome?.trim().toLowerCase();
  const valor = canonicalRoletaAtualValue(roleta.bitrix_roleta_valor ?? "");
  return (nome === "bolsão" || nome === "bolsao") && valor === "focus";
}

/**
 * Separa o bolsão monolítico em roletas por `oportunidades.roleta_atual`
 * (valores do campo Roleta Atual no Bitrix) e propaga permissões existentes.
 */
export async function reconcileBolsaoRoletas(admin: AdminClient): Promise<void> {
  const config = getBolsaoSyncDefaults();

  const { data: oportunidades, error: oportunidadesError } = await admin
    .from("oportunidades")
    .select("id, roleta_atual")
    .not("roleta_atual", "is", null);

  if (oportunidadesError) throw oportunidadesError;

  const displayByCanonical = new Map<string, string>();
  for (const item of oportunidades ?? []) {
    const trimmed = item.roleta_atual?.trim();
    if (!trimmed) continue;
    const canonical = canonicalRoletaAtualValue(trimmed);
    if (!displayByCanonical.has(canonical)) {
      displayByCanonical.set(canonical, trimmed);
    }
  }

  if (!displayByCanonical.size) return;

  const roletaIdByCanonical = new Map<string, string>();
  for (const display of displayByCanonical.values()) {
    const id = await upsertBolsaoRoleta(admin, display, config);
    roletaIdByCanonical.set(canonicalRoletaAtualValue(display), id);
  }

  const newRoletaIds = [...roletaIdByCanonical.values()];

  for (const item of oportunidades ?? []) {
    const trimmed = item.roleta_atual?.trim();
    if (!trimmed) continue;
    const roletaId = roletaIdByCanonical.get(canonicalRoletaAtualValue(trimmed));
    if (!roletaId) continue;

    const { error } = await admin
      .from("oportunidades")
      .update({ roleta_id: roletaId })
      .eq("id", item.id);

    if (error) throw error;
  }

  const { data: roletasBolsao, error: roletasError } = await admin
    .from("roletas")
    .select("id, nome, bitrix_funil_id, bitrix_roleta_valor")
    .eq("bitrix_category_id", config.categoryId)
    .eq("ativa", true);

  if (roletasError) throw roletasError;

  const monolithicIds = (roletasBolsao ?? [])
    .filter(isMonolithicBolsaoRoleta)
    .map((item) => item.id);

  if (monolithicIds.length && newRoletaIds.length) {
    const { data: atribuicoes, error: atribuicoesError } = await admin
      .from("roletas_corretor")
      .select("corretor_id, roleta_id, liberado_por")
      .in("roleta_id", monolithicIds);

    if (atribuicoesError) throw atribuicoesError;

    const inserts = (atribuicoes ?? []).flatMap((atribuicao) =>
      newRoletaIds
        .filter((roletaId) => roletaId !== atribuicao.roleta_id)
        .map((roletaId) => ({
          corretor_id: atribuicao.corretor_id,
          roleta_id: roletaId,
          liberado_por: atribuicao.liberado_por,
        })),
    );

    if (inserts.length) {
      const { error: insertError } = await admin
        .from("roletas_corretor")
        .upsert(inserts, { onConflict: "roleta_id,corretor_id", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
  }

  for (const monolithicId of monolithicIds) {
    const { count, error: countError } = await admin
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("roleta_id", monolithicId);

    if (countError) throw countError;
    if (count === 0) {
      const { error: deactivateError } = await admin
        .from("roletas")
        .update({ ativa: false })
        .eq("id", monolithicId);
      if (deactivateError) throw deactivateError;
    }
  }
}
