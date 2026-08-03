"use server";

import { revalidatePath } from "next/cache";
import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { canManageOperacao } from "@/lib/auth/perfil";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { syncBitrixDeals, type BitrixDealsSyncSummary } from "@/lib/bitrix/sync-deals";
import { syncComercialGeralDeals, type ComercialGeralSyncSummary } from "@/lib/bitrix/sync-comercial-geral";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

export type SyncLeadsResult =
  | { ok: true; summary: BitrixDealsSyncSummary; syncedAt: string }
  | { ok: false; error: string };

export type SyncComercialGeralResult =
  | { ok: true; summary: ComercialGeralSyncSummary; syncedAt: string }
  | { ok: false; error: string };

export async function sincronizarComercialGeralBitrix(): Promise<SyncComercialGeralResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, error: "Faça login novamente para sincronizar os dados." };
  }

  const profile = await loadAuthProfile(authData.user);
  if (!profile || !canManageOperacao(profile.perfil) || !profile.paginasAcesso.includes("/comercial-geral")) {
    return { ok: false, error: "Seu perfil não pode sincronizar o Comercial Geral." };
  }
  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }
  if (!hasBitrixEnv()) {
    return { ok: false, error: "BITRIX24_BASE_URL não configurada no servidor." };
  }

  try {
    const summary = await syncComercialGeralDeals();
    const syncedAt = new Date().toISOString();
    revalidatePath("/comercial-geral");
    revalidatePath("/dashboard");
    return { ok: true, summary, syncedAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível sincronizar o Comercial Geral.",
    };
  }
}

export async function sincronizarLeadsBitrix(): Promise<SyncLeadsResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  if (!authUser) {
    return { ok: false, error: "Faça login novamente para sincronizar os leads." };
  }

  const profile = await loadAuthProfile(authUser);
  if (!profile?.ativo) {
    return { ok: false, error: "Seu acesso está inativo e não pode sincronizar leads." };
  }

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }

  if (!hasBitrixEnv()) {
    return { ok: false, error: "BITRIX24_BASE_URL não configurada no servidor." };
  }

  const startedAt = Date.now();
  console.info("[sync-leads] started", { source: "broker-wallet" });

  try {
    const summary = await syncBitrixDeals();
    const syncedAt = new Date().toISOString();
    revalidatePath("/corretor");
    revalidatePath("/dashboard");
    revalidatePath("/roletas");
    console.info("[sync-leads] completed", {
      durationMs: Date.now() - startedAt,
      encontrados: summary.encontrados,
      importados: summary.importados,
      removidosDaFila: summary.removidosDaFila,
      roletas: summary.roletas,
    });
    return { ok: true, summary, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar os leads.";
    console.error("[sync-leads] failed", {
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { ok: false, error: message };
  }
}
