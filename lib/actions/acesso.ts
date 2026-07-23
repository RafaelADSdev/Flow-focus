"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { syncBitrixPeople, type BitrixPeopleSyncSummary } from "@/lib/bitrix/sync-people";
import { hasBitrixEnv } from "@/lib/bitrix/client";
import { editarAcessoSchema, novoAcessoSchema } from "@/lib/schemas/acesso";
import { authErrorMessage } from "@/lib/supabase/auth-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

type ActionResult = { ok: true } | { ok: false; error: string };
type SyncActionResult = { ok: true; summary: BitrixPeopleSyncSummary } | { ok: false; error: string };

function displayName(email: string) {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function revalidateAcesso() {
  revalidatePath("/configuracoes/acesso");
  revalidatePath("/dashboard");
  revalidatePath("/roletas");
}

export async function sincronizarEquipesBitrix(): Promise<SyncActionResult> {
  await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada no servidor." };
  }

  if (!hasBitrixEnv()) {
    return { ok: false, error: "BITRIX24_BASE_URL não configurada no servidor." };
  }

  try {
    const summary = await syncBitrixPeople();
    revalidateAcesso();
    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar as equipes.";
    return { ok: false, error: authErrorMessage(message, message) };
  }
}

export async function criarAcesso(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada. A criação de acessos exige a chave de serviço." };
  }

  const parsed = novoAcessoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos do formulário." };
  }

  const payload = parsed.data;
  const admin = createAdminClient();
  const nome = displayName(payload.email);

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.senha,
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: { perfil: payload.perfil },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      return { ok: false, error: "Já existe um acesso com este e-mail." };
    }
    return { ok: false, error: authErrorMessage(authError.message, authError.message) };
  }

  const userId = authData.user.id;
  const { error: profileError } = await admin
    .from("usuarios")
    .upsert({
      id: userId,
      nome,
      email: payload.email,
      perfil: payload.perfil,
      equipe_id: payload.equipeId,
      ativo: true,
    }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileError.message };
  }

  revalidateAcesso();
  return { ok: true };
}

export async function atualizarAcesso(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada. A edição de acessos exige a chave de serviço." };
  }

  const parsed = editarAcessoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos do formulário." };
  }

  const payload = parsed.data;
  const admin = createAdminClient();

  const { data: target, error: targetError } = await admin
    .from("usuarios")
    .select("id")
    .eq("id", payload.id)
    .single();

  if (targetError) {
    return { ok: false, error: targetError.message };
  }

  const { error: profileError } = await admin
    .from("usuarios")
    .update({
      perfil: payload.perfil,
      equipe_id: payload.equipeId,
      ativo: true,
    })
    .eq("id", payload.id);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const novaSenha = payload.senha.trim();
  const authUpdate: { app_metadata: { perfil: typeof payload.perfil }; password?: string } = {
    app_metadata: { perfil: payload.perfil },
  };
  if (novaSenha) authUpdate.password = novaSenha;

  const { error: authError } = await admin.auth.admin.updateUserById(payload.id, authUpdate);
  if (authError) {
    return { ok: false, error: authErrorMessage(authError.message) };
  }

  revalidateAcesso();
  return { ok: true };
}

export async function desativarAcesso(userId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada. A exclusão de acessos exige a chave de serviço." };
  }

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) {
    return { ok: false, error: "Acesso inválido." };
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("usuarios").update({ ativo: false }).eq("id", parsed.data);
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data, { ban_duration: "876000h" });
  if (authError) {
    return { ok: false, error: authErrorMessage(authError.message) };
  }

  revalidateAcesso();
  return { ok: true };
}

export async function reativarAcesso(userId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!hasSupabaseSecretKey()) {
    return { ok: false, error: "SUPABASE_SECRET_KEY não configurada." };
  }

  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) {
    return { ok: false, error: "Acesso inválido." };
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin.from("usuarios").update({ ativo: true }).eq("id", parsed.data);
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data, { ban_duration: "none" });
  if (authError) {
    return { ok: false, error: authErrorMessage(authError.message) };
  }

  revalidateAcesso();
  return { ok: true };
}
