import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const fileName of [".env.local", ".env"]) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) continue;
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

const categoryId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("oportunidades")
      .select("bitrix_stage_id, data_criacao_bitrix, roleta_id, roleta_atual")
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const [rows, roletas] = await Promise.all([
  fetchAll(),
  supabase.from("roletas").select("id, bitrix_category_id"),
]);

const roletaById = new Map((roletas.data ?? []).map((r) => [r.id, r]));

function matchesEsteira(item) {
  const roleta = roletaById.get(item.roleta_id);
  if (roleta && String(roleta.bitrix_category_id ?? "") === String(categoryId)) return true;
  return String(item.bitrix_stage_id ?? "").startsWith(`C${categoryId}:`);
}

function entryDate(item) {
  return item.data_criacao_bitrix;
}

const esteira = rows.filter(matchesEsteira);
const now = new Date();
const start = new Date(now);
start.setDate(start.getDate() - 59);
start.setHours(0, 0, 0, 0);
const end = new Date(now);
end.setHours(23, 59, 59, 999);

const noPeriodo = esteira.filter((item) => {
  const date = entryDate(item);
  return date && date >= start.toISOString() && date <= end.toISOString();
});

function countStages(items) {
  const map = new Map();
  for (const item of items) {
    const stage = String(item.bitrix_stage_id ?? "").split("#")[0];
    if (!stage) continue;
    map.set(stage, (map.get(stage) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

console.log(JSON.stringify({
  totalRows: rows.length,
  esteira: esteira.length,
  noPeriodo60d: noPeriodo.length,
  funnelStages60d: countStages(noPeriodo),
  funnelStagesAll: countStages(esteira),
}, null, 2));
