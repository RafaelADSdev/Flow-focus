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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SECRET_KEY ?? "",
  { auth: { persistSession: false } },
);

const perfilByUserId = new Map();
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    perfilByUserId.set(user.id, mapPerfil(String(user.app_metadata?.perfil ?? "corretor")));
  }
  if (data.users.length < 1000) break;
}

const { data: usuarios, error } = await admin
  .from("usuarios")
  .select("id, nome, email, equipe_id, equipe_nome, ativo")
  .eq("ativo", true)
  .order("nome");

if (error) throw error;

const corretores = (usuarios ?? [])
  .map((usuario) => ({ ...usuario, perfil: perfilByUserId.get(usuario.id) ?? "corretor" }))
  .filter((usuario) => usuario.perfil === "corretor");

const { count: roletas } = await admin.from("roletas").select("id", { count: "exact", head: true }).eq("ativa", true);

console.log(JSON.stringify({
  roletas_ativas: roletas ?? 0,
  usuarios_ativos: usuarios?.length ?? 0,
  corretores_para_tela: corretores.length,
  amostra: corretores.slice(0, 5).map((item) => ({ nome: item.nome, equipe: item.equipe_nome })),
}, null, 2));
