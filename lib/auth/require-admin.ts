import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AppUser } from "@/lib/types/app-user";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";

export async function requireAdmin(redirectTo: Route = "/configuracoes") {
  if (!hasSupabaseEnv()) {
    redirect(redirectTo);
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("nome, perfil, equipe_nome, ativo")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error || !profile || profile.perfil !== "admin" || !profile.ativo) {
    redirect(redirectTo);
  }

  const user: AppUser = {
    nome: profile.nome,
    perfil: profile.perfil,
    equipeNome: profile.equipe_nome,
    iniciais: initials(profile.nome),
  };

  return user;
}

export async function isAdmin() {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return false;

  const { data: profile } = await supabase
    .from("usuarios")
    .select("perfil, ativo")
    .eq("id", authUser.id)
    .maybeSingle();

  return profile?.perfil === "admin" && profile.ativo === true;
}
