"use server";

import { loadAuthProfile } from "@/lib/auth/load-auth-profile";
import { getExpiringLeadsForEmail, getTeamPipelineForEmail } from "@/lib/bitrix/team";
import { createClient } from "@/lib/supabase/server";
import type { BrokerExemption, ExpiringLeadsResult, TeamPipeline } from "@/lib/types/equipe";

async function getAuthorizedUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, error: "Faça login novamente para consultar a equipe." } as const;
  const profile = await loadAuthProfile(user);
  if (!profile?.paginasAcesso.includes("/equipe")) {
    return { supabase, user: null, error: "Seu perfil não possui acesso à tela Equipe." } as const;
  }
  return { supabase, user, error: null } as const;
}

export async function loadTeamPipeline(month: string | null): Promise<TeamPipeline> {
  const auth = await getAuthorizedUser();
  if (!auth.user) {
    return {
      ok: false, error: auth.error, scopeLabel: "Equipe", categoryId: "", categoryName: "Comercial - GERAL",
      departments: [], teams: [], members: [], stages: [], rows: [],
      totals: { totalDeals: 0, criticos: 0, stages: {}, stageCriticos: {} },
      updatedAt: new Date().toISOString(),
    };
  }
  return getTeamPipelineForEmail(auth.user.email ?? "", month);
}

export async function loadExpiringLeads(brokerId: string): Promise<ExpiringLeadsResult> {
  const auth = await getAuthorizedUser();
  if (!auth.user) {
    return { ok: false, error: auth.error, brokerId, items: [], updatedAt: new Date().toISOString() };
  }
  return getExpiringLeadsForEmail(auth.user.email ?? "", brokerId);
}

export async function loadBrokerExemptions(): Promise<{ ok: boolean; items: BrokerExemption[] }> {
  const auth = await getAuthorizedUser();
  if (!auth.user) return { ok: false, items: [] };
  const { data, error } = await auth.supabase
    .from("broker_exemptions")
    .select("bitrix_id, broker_name, reason, created_by, created_at, updated_at")
    .order("broker_name");
  if (error) return { ok: false, items: [] };
  return { ok: true, items: data };
}
