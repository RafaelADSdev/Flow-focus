import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminAuthStorage, createServiceRoleFetch } from "@/lib/supabase/admin-fetch";
import { getSupabaseEnv, getSupabaseSecretKey } from "./env";

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey = getSupabaseSecretKey();
  const serviceFetch = createServiceRoleFetch(secretKey);

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storage: createAdminAuthStorage(),
    },
    global: {
      fetch: serviceFetch,
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    },
  });
}
