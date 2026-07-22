const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function hasSupabaseEnv() {
  return Boolean(url && publishableKey);
}

export function hasSupabaseSecretKey() {
  return Boolean(url && secretKey);
}

export function getSupabaseEnv() {
  if (!url || !publishableKey) {
    throw new Error("Variáveis do Supabase ausentes. Copie .env.example para .env.local.");
  }
  return { url, publishableKey };
}

export function getSupabaseSecretKey() {
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY ausente. Configure a chave de serviço no .env.local.");
  }
  return secretKey;
}
