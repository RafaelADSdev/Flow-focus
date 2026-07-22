import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv, getSupabaseSecretKey } from "./env";

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey = getSupabaseSecretKey();
  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
