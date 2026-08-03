/**
 * Diagnostica e sincroniza o Bolsão (category 36 + tag Focus).
 *
 * Uso: node scripts/sync-bitrix-bolsao.mjs
 * Opcional: DRY_RUN=1 node scripts/sync-bitrix-bolsao.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const bitrixBaseUrl = (process.env.BITRIX24_BASE_URL ?? "").replace(/\/$/, "");
const categoryId = process.env.BITRIX24_FILTER_CATEGORY_ID ?? "36";
const stageId = process.env.BITRIX24_FILTER_STAGE_ID ?? "C36:NEW";
const rouletteField = process.env.BITRIX24_ROULETTE_FIELD ?? "UF_CRM_1726667595972";
const rouletteTag = process.env.BITRIX24_ROULETTE_TAG ?? "Focus";
const poolName = process.env.BITRIX24_POOL_NAME ?? "Bolsão";
const dryRun = process.env.DRY_RUN === "1";

if (!supabaseUrl || !secretKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
if (!bitrixBaseUrl) throw new Error("Configure BITRIX24_BASE_URL.");

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunks(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function rouletteValue(deal) {
  const value = deal[rouletteField];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
}

function isEligible(deal) {
  return String(deal.CATEGORY_ID ?? "") === categoryId
    && String(deal.STAGE_ID ?? "") === stageId
    && rouletteValue(deal).toLocaleLowerCase().includes(rouletteTag.toLocaleLowerCase());
}

async function bitrixPage(filters, start = 0) {
  const params = new URLSearchParams({ ...filters, start: String(start) });
  for (const field of [
    "ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID",
    "OPPORTUNITY", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY", rouletteField,
  ]) {
    params.append("select[]", field);
  }

  const url = new URL(`${bitrixBaseUrl}/crm.deal.list.json`);
  params.forEach((value, key) => url.searchParams.append(key, value));

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(30_000) });
    if (response.status === 429 && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`Bitrix HTTP ${response.status}`);
    const body = await response.json();
    if (body.error || body.result === undefined) {
      throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
    }
    return body;
  }
  throw new Error("Bitrix 429");
}

async function fetchAll(filters) {
  const deals = [];
  let lastId = "0";
  while (true) {
    const page = await bitrixPage({
      ...filters,
      "filter[>ID]": lastId,
      "order[ID]": "ASC",
    }, -1);
    if (!page.result.length) break;
    deals.push(...page.result);
    const nextLastId = String(page.result.at(-1)?.ID ?? "");
    if (!/^\d+$/.test(nextLastId) || BigInt(nextLastId) <= BigInt(lastId)) {
      throw new Error("A paginação do Bitrix não avançou para o próximo ID.");
    }
    lastId = nextLastId;
    process.stdout.write(`\r  negócios: ${deals.length}   `);
    if (page.result.length < 50) break;
  }
  process.stdout.write("\n");
  return { deals, reportedTotal: null };
}

async function countOnly(filters) {
  const page = await bitrixPage(filters, 0);
  return typeof page.total === "number" ? page.total : page.result.length;
}

async function main() {
  console.log("=== Diagnóstico Bolsão ===");
  console.log(`Category ${categoryId} · etapa ${stageId} · tag ${rouletteTag} · pool ${poolName}`);

  const focusAnyStage = await countOnly({
    "filter[CATEGORY_ID]": categoryId,
    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,
  });
  console.log(`Bitrix Focus na category (qualquer etapa): ${focusAnyStage}`);

  const focusNewReported = await countOnly({
    "filter[CATEGORY_ID]": categoryId,
    "filter[STAGE_ID]": stageId,
    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,
  });
  console.log(`Bitrix Focus + ${stageId} (total reportado): ${focusNewReported}`);

  console.log("Buscando todos os deals elegíveis (ID crescente + start=-1)...");
  const { deals, reportedTotal } = await fetchAll({
    "filter[CATEGORY_ID]": categoryId,
    "filter[STAGE_ID]": stageId,
    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,
  });
  const eligible = deals.filter(isEligible);
  console.log(`Baixados: ${deals.length} · elegíveis após filtro local: ${eligible.length} · total Bitrix: ${reportedTotal ?? "n/d"}`);

  const byStage = new Map();
  for (const deal of deals) {
    const key = String(deal.STAGE_ID ?? "(vazio)");
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }
  console.log("Distribuição por STAGE_ID (página baixada):");
  for (const [stage, count] of [...byStage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${stage}: ${count}`);
  }

  const { data: existingPool } = await supabase
    .from("roletas")
    .select("id")
    .eq("nome", poolName)
    .maybeSingle();

  let dbBefore = 0;
  if (existingPool?.id) {
    const before = await supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("roleta_id", existingPool.id)
      .is("corretor_id", null)
      .is("captada_em", null);
    if (before.error) throw before.error;
    dbBefore = before.count ?? 0;
  }
  console.log(`DB disponíveis no ${poolName} antes: ${dbBefore}`);

  if (dryRun) {
    console.log("DRY_RUN=1 — sync não executado.");
    return;
  }

  console.log("Sincronizando...");
  const funilId = `${categoryId}:${stageId}:${rouletteTag.toLocaleLowerCase()}`;
  const { data: roulette, error: rouletteError } = await supabase.from("roletas").upsert({
    nome: poolName,
    bitrix_funil_id: funilId,
    bitrix_category_id: categoryId,
    bitrix_roleta_valor: rouletteTag,
    descricao: `Negócios em ${stageId} cuja Roleta Atual contém ${rouletteTag}`,
    ativa: true,
  }, { onConflict: "bitrix_funil_id" }).select("id").single();
  if (rouletteError) throw rouletteError;

  const dealIds = eligible.map((deal) => String(deal.ID));
  const existingRows = (await Promise.all(chunks(dealIds, 300).map(async (ids) => {
    const { data, error } = await supabase
      .from("oportunidades")
      .select("bitrix_deal_id,corretor_id,captada_em")
      .in("bitrix_deal_id", ids);
    if (error) throw error;
    return data ?? [];
  }))).flat();
  const existing = new Map(existingRows.map((row) => [row.bitrix_deal_id, row]));

  // Schema remoto pode não ter a coluna status — usa corretor_id/captada_em.
  const opportunities = eligible.map((deal) => {
    const dealId = String(deal.ID);
    const prev = existing.get(dealId);
    return {
      bitrix_deal_id: dealId,
      roleta_id: roulette.id,
      titulo: String(deal.TITLE ?? `Negocio #${dealId}`),
      valor: Number(deal.OPPORTUNITY ?? 0),
      roleta_atual: rouletteValue(deal),
      bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
      bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
      data_criacao_bitrix: String(deal.DATE_CREATE ?? "") || null,
      ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
      // Mantém atribuição existente
      ...(prev?.corretor_id
        ? { corretor_id: prev.corretor_id, captada_em: prev.captada_em }
        : { corretor_id: null, captada_em: null }),
    };
  });

  for (const batch of chunks(opportunities, 250)) {
    const { error } = await supabase.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });
    if (error) throw error;
  }

  const syncedIds = new Set(dealIds);
  const { data: stillAvailable, error: availableError } = await supabase
    .from("oportunidades")
    .select("id,bitrix_deal_id")
    .eq("roleta_id", roulette.id)
    .is("corretor_id", null)
    .is("captada_em", null);
  if (availableError) throw availableError;

  const staleIds = (stillAvailable ?? [])
    .filter((item) => item.bitrix_deal_id && !syncedIds.has(item.bitrix_deal_id))
    .map((item) => item.id);

  let removidos = 0;
  for (const batch of chunks(staleIds, 250)) {
    // Sem coluna status: remove da fila do bolsão deletando órfãos não sincronizados.
    const { error } = await supabase.from("oportunidades").delete().in("id", batch);
    if (error) throw error;
    removidos += batch.length;
  }

  const { count: dbAfter, error: afterError } = await supabase
    .from("oportunidades")
    .select("id", { count: "exact", head: true })
    .eq("roleta_id", roulette.id)
    .is("corretor_id", null)
    .is("captada_em", null);
  if (afterError) throw afterError;

  console.log("=== Resultado ===");
  console.log(`Importados/atualizados: ${eligible.length}`);
  console.log(`Removidos da fila (stale): ${removidos}`);
  console.log(`DB disponíveis no ${poolName}: ${dbAfter ?? 0}`);
  console.log(`Focus category qualquer etapa: ${focusAnyStage}`);
  console.log(`Focus + ${stageId}: ${eligible.length}`);
  console.log(`Gap (category Focus − NEW): ${focusAnyStage - eligible.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
