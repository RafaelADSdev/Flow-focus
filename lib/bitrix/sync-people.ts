import "server-only";

import type { User } from "@supabase/supabase-js";
import { defaultPaginasForPerfil } from "@/lib/auth/paginas-acesso";
import { bitrixCall, bitrixCallPage, hasBitrixEnv } from "@/lib/bitrix/client";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export type BitrixPeopleSyncSummary = {
  equipes: number;
  usuariosAtivos: number;
  contasCriadas: number;
  desativados: number;
  corretoresAtivos: number;
};

function getTeamDepartmentIds() {
  return (process.env.BITRIX24_TEAM_DEPARTMENT_IDS ?? "454,448,551")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchDepartment(id: string) {
  const result = (await bitrixCall<JsonRecord[]>("department.get", new URLSearchParams({ ID: id })))[0];
  if (!result) throw new Error(`Departamento ${id} não encontrado no Bitrix.`);
  return result;
}

async function fetchActiveTeamUsers(departmentId: string) {
  const users: JsonRecord[] = [];
  let start = 0;

  do {
    const page = await bitrixCallPage<JsonRecord[]>("user.get", new URLSearchParams({
      "FILTER[UF_DEPARTMENT]": departmentId,
      "FILTER[ACTIVE]": "true",
      start: String(start),
    }));

    users.push(...page.result);
    if (page.next === undefined) break;
    start = page.next;
  } while (true);

  return users;
}

async function listAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function syncBitrixPeople(): Promise<BitrixPeopleSyncSummary> {
  if (!hasBitrixEnv()) {
    throw new Error("BITRIX24_BASE_URL não configurada.");
  }

  const teamDepartmentIds = getTeamDepartmentIds();
  const directorateDepartmentId = process.env.BITRIX24_DIRECTORATE_DEPARTMENT_ID ?? "442";
  const superintendencyDepartmentId = process.env.BITRIX24_SUPERINTENDENCY_DEPARTMENT_ID ?? "444";
  const admin = createAdminClient();

  const teams = await Promise.all(teamDepartmentIds.map(fetchDepartment));
  const teamUsers = await Promise.all(teamDepartmentIds.map(async (departmentId) => ({
    departmentId,
    users: await fetchActiveTeamUsers(departmentId),
  })));

  const teamRows = teams.map((team) => ({
    nome: String(team.NAME ?? `Equipe ${team.ID}`),
    bitrix_department_id: String(team.ID),
    bitrix_parent_department_id: String(team.PARENT ?? "") || null,
    bitrix_head_user_id: String(team.UF_HEAD ?? "") || null,
    bitrix_diretoria_id: directorateDepartmentId,
    bitrix_superintendencia_id: superintendencyDepartmentId,
  }));

  const { data: savedTeams, error: teamError } = await admin
    .from("equipes")
    .upsert(teamRows, { onConflict: "bitrix_department_id" })
    .select("id,nome,bitrix_department_id,bitrix_head_user_id");

  if (teamError) throw teamError;

  const authUsers = await listAuthUsers(admin);
  const authByEmail = new Map(authUsers.filter((user) => user.email).map((user) => [user.email!.toLowerCase(), user]));
  const authByBitrixId = new Map(
    authUsers
      .filter((user) => user.app_metadata?.bitrix_user_id)
      .map((user) => [String(user.app_metadata.bitrix_user_id), user]),
  );

  const syncedBitrixIds = new Set<string>();
  const authIdByBitrixId = new Map<string, string>();
  let created = 0;

  for (const group of teamUsers) {
    const team = savedTeams.find((item) => String(item.bitrix_department_id) === group.departmentId);
    if (!team) throw new Error(`Equipe ${group.departmentId} não persistida.`);

    for (const bitrixUser of group.users) {
      const bitrixUserId = String(bitrixUser.ID ?? "");
      const email = String(bitrixUser.EMAIL ?? "").trim().toLowerCase();
      if (!bitrixUserId || !email) continue;

      const name = [bitrixUser.NAME, bitrixUser.LAST_NAME]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const profile = bitrixUserId === String(team.bitrix_head_user_id) ? "lider" : "corretor";
      let authUser = authByBitrixId.get(bitrixUserId) ?? authByEmail.get(email);

      if (!authUser) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { nome: name },
          app_metadata: { perfil: profile, bitrix_user_id: bitrixUserId },
        });
        if (error) throw error;
        authUser = data.user;
        authByEmail.set(email, authUser);
        authByBitrixId.set(bitrixUserId, authUser);
        created += 1;
      } else {
        const currentProfile = String(authUser.app_metadata?.perfil ?? "");
        const safeProfile = ["admin", "diretora"].includes(currentProfile) ? currentProfile : profile;
        const { error } = await admin.auth.admin.updateUserById(authUser.id, {
          app_metadata: { ...authUser.app_metadata, perfil: safeProfile, bitrix_user_id: bitrixUserId },
          user_metadata: { ...authUser.user_metadata, nome: name },
        });
        if (error) throw error;
      }

      const effectiveProfile = ["admin", "diretora"].includes(String(authUser.app_metadata?.perfil ?? ""))
        ? String(authUser.app_metadata.perfil)
        : profile;

      const typedProfile = effectiveProfile as "corretor" | "lider" | "diretora" | "admin";
      const { data: existingUsuario } = await admin
        .from("usuarios")
        .select("paginas_acesso")
        .eq("id", authUser.id)
        .maybeSingle();

      const hasCustomPages = Array.isArray(existingUsuario?.paginas_acesso) && existingUsuario.paginas_acesso.length > 0;

      const usuarioRow = {
        id: authUser.id,
        nome: name,
        email,
        equipe_id: team.id,
        equipe_nome: team.nome,
        bitrix_user_id: bitrixUserId,
        bitrix_department_id: group.departmentId,
        ativo: true,
        ...(hasCustomPages ? {} : { paginas_acesso: defaultPaginasForPerfil(typedProfile) }),
      };

      let { error: userError } = await admin.from("usuarios").upsert({
        ...usuarioRow,
        perfil: typedProfile,
      }, { onConflict: "id" });

      if (userError?.message?.includes("perfil") || userError?.message?.includes("paginas_acesso")) {
        const { paginas_acesso: _pages, ...withoutPages } = usuarioRow;
        ({ error: userError } = await admin.from("usuarios").upsert(withoutPages, { onConflict: "id" }));
      }
      if (userError) throw userError;

      syncedBitrixIds.add(bitrixUserId);
      authIdByBitrixId.set(bitrixUserId, authUser.id);
    }
  }

  for (const team of savedTeams) {
    const leaderId = authIdByBitrixId.get(String(team.bitrix_head_user_id ?? ""));
    if (leaderId) {
      const { error } = await admin.from("equipes").update({ lider_id: leaderId }).eq("id", team.id);
      if (error) throw error;
    }
  }

  const { data: previouslySynced, error: previousError } = await admin
    .from("usuarios")
    .select("id,bitrix_user_id")
    .in("bitrix_department_id", teamDepartmentIds);

  if (previousError) throw previousError;

  const inactiveIds = (previouslySynced ?? [])
    .filter((user) => user.bitrix_user_id && !syncedBitrixIds.has(user.bitrix_user_id))
    .map((user) => user.id);

  if (inactiveIds.length) {
    const { error } = await admin.from("usuarios").update({ ativo: false }).in("id", inactiveIds);
    if (error) throw error;
  }

  const { count: corretores } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("perfil", "corretor")
    .eq("ativo", true);

  return {
    equipes: savedTeams.length,
    usuariosAtivos: syncedBitrixIds.size,
    contasCriadas: created,
    desativados: inactiveIds.length,
    corretoresAtivos: corretores ?? 0,
  };
}
