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

function mapPerfil(value) {
  switch (value) {
    case "admin": return "admin";
    case "diretora":
    case "diretor": return "diretora";
    case "lider":
    case "leader": return "lider";
    default: return "corretor";
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

let updated = 0;
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;

  for (const user of data.users) {
    const perfil = mapPerfil(String(user.app_metadata?.perfil ?? "corretor"));
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ perfil })
      .eq("id", user.id);
    if (updateError) {
      if (updateError.message.includes("perfil")) {
        console.error("A coluna perfil ainda não existe. Rode scripts/repair-usuarios-perfil.sql no Supabase.");
        process.exit(1);
      }
      throw updateError;
    }
    updated += 1;
  }

  if (data.users.length < 1000) break;
}

console.log(`Perfis sincronizados em usuarios: ${updated}`);
