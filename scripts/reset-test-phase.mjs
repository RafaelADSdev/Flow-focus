/**
 * Encerra a fase de testes: zera limites diários, libera bloqueios,
 * encerra auditorias pendentes e devolve capturas ao bolsão.
 *
 * Uso: node scripts/reset-test-phase.mjs
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local
 */
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
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em .env.local.");
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NOTE = "Encerrada automaticamente: fim da fase de testes.";

async function listAll(table, select, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let query = admin.from(table).select(select).range(from, from + 999);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function countTable(table, filter) {
  let query = admin.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const before = {
    capturasDiarias: await countTable("capturas_diarias", (q) => q.gt("quantidade_captada", 0)),
    auditoriasPendentes: await countTable("auditorias", (q) => q.eq("status", "pendente")),
    bloqueiosAtivos: await countTable("bloqueios", (q) => q.is("liberado_em", null)),
    capturasAtivas: await countTable("oportunidades", (q) => q.not("captada_em", "is", null)),
  };

  console.log("Antes:", before);

  const { error: capturasError } = await admin.from("capturas_diarias").delete().gte("quantidade_captada", 0);
  if (capturasError) throw new Error(`capturas_diarias: ${capturasError.message}`);

  const now = new Date().toISOString();
  const { error: bloqueiosError } = await admin
    .from("bloqueios")
    .update({ liberado_em: now })
    .is("liberado_em", null);
  if (bloqueiosError) throw new Error(`bloqueios: ${bloqueiosError.message}`);

  const captured = await listAll(
    "oportunidades",
    "id",
    (query) => query.not("captada_em", "is", null),
  );

  for (let index = 0; index < captured.length; index += 250) {
    const batch = captured.slice(index, index + 250).map((item) => item.id);
    let { error } = await admin
      .from("oportunidades")
      .update({
        corretor_id: null,
        captada_em: null,
        status: "disponivel",
        tentativa_contato_ok: false,
        comentario_bitrix_ok: false,
        etapa_atualizada_ok: false,
        auditoria_aprovada_em: null,
        ultima_auditoria_em: null,
        auditoria_lider_id: null,
      })
      .in("id", batch);

    if (error?.message?.includes("status")) {
      ({ error } = await admin
        .from("oportunidades")
        .update({
          corretor_id: null,
          captada_em: null,
          tentativa_contato_ok: false,
          comentario_bitrix_ok: false,
          etapa_atualizada_ok: false,
          auditoria_aprovada_em: null,
          ultima_auditoria_em: null,
          auditoria_lider_id: null,
        })
        .in("id", batch));
    }

    if (error) throw new Error(`oportunidades: ${error.message}`);
  }

  const { error: auditoriasError } = await admin
    .from("auditorias")
    .update({
      status: "aprovado",
      concluida_em: now,
      observacoes: NOTE,
    })
    .eq("status", "pendente");
  if (auditoriasError) throw new Error(`auditorias: ${auditoriasError.message}`);

  const after = {
    capturasDiarias: await countTable("capturas_diarias", (q) => q.gt("quantidade_captada", 0)),
    auditoriasPendentes: await countTable("auditorias", (q) => q.eq("status", "pendente")),
    bloqueiosAtivos: await countTable("bloqueios", (q) => q.is("liberado_em", null)),
    capturasAtivas: await countTable("oportunidades", (q) => q.not("captada_em", "is", null)),
  };

  console.log("Depois:", after);
  console.log(`Capturas devolvidas ao bolsão: ${captured.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
