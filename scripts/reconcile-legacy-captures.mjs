import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BOLSÃO_CATEGORY_ID = process.env.BITRIX24_FILTER_CATEGORY_ID ?? "36";

async function listAll(table, select, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from(table).select(select).range(from, from + 999);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function buildConfirmedIds(opportunities, capturasDiarias) {
  const limitByBrokerDate = new Map();
  for (const row of capturasDiarias) {
    limitByBrokerDate.set(`${row.corretor_id}:${row.data}`, row.quantidade_captada);
  }

  const groups = new Map();
  for (const opportunity of opportunities) {
    if (!opportunity.corretor_id || !opportunity.captada_em) continue;
    const dataCaptura = opportunity.captada_em.slice(0, 10);
    const key = `${opportunity.corretor_id}:${dataCaptura}`;
    const group = groups.get(key) ?? [];
    group.push({ id: opportunity.id, captada_em: opportunity.captada_em });
    groups.set(key, group);
  }

  const confirmed = new Set();
  for (const [key, group] of groups) {
    const limit = limitByBrokerDate.get(key) ?? 0;
    if (limit <= 0) continue;
    group
      .sort((a, b) => a.captada_em.localeCompare(b.captada_em) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .forEach((item) => confirmed.add(item.id));
  }
  return confirmed;
}

async function main() {
  const [roletas, capturasDiarias, opportunities] = await Promise.all([
    listAll("roletas", "id, bitrix_category_id, bitrix_funil_id"),
    listAll("capturas_diarias", "corretor_id, data, quantidade_captada"),
    listAll(
      "oportunidades",
      "id, corretor_id, captada_em, roleta_id",
      (query) => query.not("corretor_id", "is", null).not("captada_em", "is", null),
    ),
  ]);

  const bolsaoRoletaIds = new Set(
    roletas
      .filter((roleta) => (
        roleta.bitrix_category_id === BOLSÃO_CATEGORY_ID
        && !String(roleta.bitrix_funil_id ?? "").includes(":dashboard")
      ))
      .map((roleta) => roleta.id),
  );

  const candidates = opportunities.filter((item) => bolsaoRoletaIds.has(item.roleta_id));
  const confirmedIds = buildConfirmedIds(candidates, capturasDiarias);
  const staleIds = candidates.filter((item) => !confirmedIds.has(item.id)).map((item) => item.id);

  console.log(`Candidatas: ${candidates.length}; confirmadas: ${confirmedIds.size}; a limpar: ${staleIds.length}`);

  for (let index = 0; index < staleIds.length; index += 250) {
    const batch = staleIds.slice(index, index + 250);
    const { error } = await admin
      .from("oportunidades")
      .update({
        captada_em: null,
        tentativa_contato_ok: false,
        comentario_bitrix_ok: false,
        etapa_atualizada_ok: false,
        auditoria_aprovada_em: null,
        ultima_auditoria_em: null,
        auditoria_lider_id: null,
      })
      .in("id", batch);
    if (error) throw new Error(error.message);
  }

  const { data: pendingAudits, error: auditsError } = await admin
    .from("auditorias")
    .select("id, corretor_id, observacoes")
    .eq("status", "pendente");
  if (auditsError) throw new Error(auditsError.message);

  let closedAudits = 0;
  for (const audit of pendingAudits ?? []) {
    const { count, error } = await admin
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", audit.corretor_id)
      .not("captada_em", "is", null)
      .is("auditoria_aprovada_em", null);
    if (error) throw new Error(error.message);
    if (count) continue;

    const { error: updateError } = await admin
      .from("auditorias")
      .update({
        status: "aprovado",
        concluida_em: new Date().toISOString(),
        observacoes: audit.observacoes?.trim()
          || "Encerrada automaticamente: sem leads capturados pelo Flow Focus pendentes.",
      })
      .eq("id", audit.id);
    if (updateError) throw new Error(updateError.message);
    closedAudits += 1;
  }

  console.log(`Auditorias pendentes encerradas: ${closedAudits}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
