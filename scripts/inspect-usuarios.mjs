import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

const { data: usuarios } = await supabase
  .from("usuarios")
  .select("id,nome,email,equipe_id,equipe_nome,bitrix_user_id,bitrix_department_id,ativo")
  .order("nome");

const { data: equipes } = await supabase
  .from("equipes")
  .select("id,nome,bitrix_head_user_id,lider_id");

console.log("usuarios", usuarios?.length ?? 0);
console.log(JSON.stringify(usuarios, null, 2));
console.log("equipes", equipes?.length ?? 0);
console.log(JSON.stringify(equipes, null, 2));

const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
for (const user of authUsers.users.slice(0, 5)) {
  console.log("auth", user.email, user.app_metadata);
}
