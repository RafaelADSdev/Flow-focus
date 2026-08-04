/**
 * Redefine a senha de todos os corretores ativos com base no ID do Bitrix24
 * (6 dígitos, zeros à esquerda). Ex.: ID 1327 → senha 001327.
 *
 * Uso: node scripts/reset-corretor-passwords.mjs
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

function passwordFromBitrixId(bitrixUserId) {
  const normalized = String(bitrixUserId).trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`ID do Bitrix inválido: ${bitrixUserId}`);
  }
  return normalized.padStart(6, "0");
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

async function main() {
  const { data: corretores, error } = await admin
    .from("usuarios")
    .select("id, nome, email, bitrix_user_id")
    .eq("perfil", "corretor")
    .eq("ativo", true)
    .not("bitrix_user_id", "is", null);

  if (error) throw new Error(error.message);

  let atualizados = 0;
  let ignorados = 0;

  for (const corretor of corretores ?? []) {
    if (!corretor.bitrix_user_id?.trim()) {
      ignorados += 1;
      continue;
    }

    let senha;
    try {
      senha = passwordFromBitrixId(corretor.bitrix_user_id);
    } catch (cause) {
      console.warn(`Ignorado ${corretor.email}: ${cause.message}`);
      ignorados += 1;
      continue;
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(corretor.id, { password: senha });
    if (updateError) {
      console.warn(`Falha em ${corretor.email}: ${updateError.message}`);
      ignorados += 1;
      continue;
    }

    atualizados += 1;
    console.log(`OK ${corretor.nome} (${corretor.email})`);
  }

  console.log(`Concluído: ${atualizados} senhas atualizadas, ${ignorados} ignorados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
