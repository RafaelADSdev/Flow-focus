const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function hasSupabaseEnv() {
  return Boolean(url && publishableKey);
}

export function getSupabaseEnv() {
  if (!url || !publishableKey) {
    throw new Error("Variaveis do Supabase ausentes. Copie .env.example para .env.local.");
  }
  return { url, publishableKey };
}
