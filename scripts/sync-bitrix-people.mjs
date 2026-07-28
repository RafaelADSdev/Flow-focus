import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const bitrixBaseUrl = (process.env.BITRIX24_BASE_URL ?? "").replace(/\/$/, "");
const teamDepartmentIds = (process.env.BITRIX24_TEAM_DEPARTMENT_IDS ?? "454,448,551")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const directorateDepartmentId = process.env.BITRIX24_DIRECTORATE_DEPARTMENT_ID ?? "442";
const superintendencyDepartmentId = process.env.BITRIX24_SUPERINTENDENCY_DEPARTMENT_ID ?? "444";

if (!supabaseUrl || !secretKey || !bitrixBaseUrl) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY e BITRIX24_BASE_URL em .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

async function bitrixCall(method, params) {
  const url = new URL(`${bitrixBaseUrl}/${method}.json`);
  params?.forEach((value, key) => url.searchParams.append(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bitrix HTTP ${response.status}`);
  const body = await response.json();
  if (body.error || body.result === undefined) {
    throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
  }
  return body;
}

async function fetchDepartment(id) {
  const result = (await bitrixCall("department.get", new URLSearchParams({ ID: id }))).result;
  if (!result?.[0]) throw new Error(`Departamento ${id} não encontrado`);
  return result[0];
}

async function fetchActiveTeamUsers(departmentId) {
  const users = [];
  let start = 0;
  do {
    const page = await bitrixCall("user.get", new URLSearchParams({
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

async function listAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function main() {
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

  const { data: savedTeams, error: teamError } = await supabase
    .from("equipes")
    .upsert(teamRows, { onConflict: "bitrix_department_id" })
    .select("id,nome,bitrix_department_id,bitrix_head_user_id");
  if (teamError) throw teamError;

  const authUsers = await listAuthUsers();
  const authByEmail = new Map(authUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user]));
  const authByBitrixId = new Map(
    authUsers
      .filter((user) => user.app_metadata?.bitrix_user_id)
      .map((user) => [String(user.app_metadata.bitrix_user_id), user]),
  );
  const syncedBitrixIds = new Set();
  const authIdByBitrixId = new Map();
  let created = 0;

  for (const group of teamUsers) {
    const team = savedTeams.find((item) => String(item.bitrix_department_id) === group.departmentId);
    if (!team) throw new Error(`Equipe ${group.departmentId} não persistida`);

    for (const bitrixUser of group.users) {
      const bitrixUserId = String(bitrixUser.ID ?? "");
      const email = String(bitrixUser.EMAIL ?? "").trim().toLowerCase();
      if (!bitrixUserId || !email) continue;

      const name = [bitrixUser.NAME, bitrixUser.LAST_NAME].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const profile = bitrixUserId === String(team.bitrix_head_user_id) ? "lider" : "corretor";
      let authUser = authByBitrixId.get(bitrixUserId) ?? authByEmail.get(email);

      if (!authUser) {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { nome: name },
          app_metadata: { perfil: profile, bitrix_user_id: bitrixUserId },
        });
        if (error) throw error;
        authUser = data.user;
        authByEmail.set(email, authUser);
        created += 1;
      } else {
        const currentProfile = String(authUser.app_metadata?.perfil ?? "");
        const safeProfile = ["admin", "diretora"].includes(currentProfile) ? currentProfile : profile;
        const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
          app_metadata: { ...authUser.app_metadata, perfil: safeProfile, bitrix_user_id: bitrixUserId },
          user_metadata: { ...authUser.user_metadata, nome: name },
        });
        if (error) throw error;
      }

      const effectiveProfile = ["admin", "diretora"].includes(String(authUser.app_metadata?.perfil ?? ""))
        ? String(authUser.app_metadata.perfil)
        : profile;

      const usuarioRow = {
        id: authUser.id,
        nome: name,
        email,
        equipe_id: team.id,
        equipe_nome: team.nome,
        bitrix_user_id: bitrixUserId,
        bitrix_department_id: group.departmentId,
        foto_url: String(bitrixUser.PERSONAL_PHOTO ?? "").trim() || null,
        ativo: true,
      };

      let { error: userError } = await supabase.from("usuarios").upsert({
        ...usuarioRow,
        perfil: effectiveProfile,
      }, { onConflict: "id" });

      if (userError?.message?.includes("perfil")) {
        ({ error: userError } = await supabase.from("usuarios").upsert(usuarioRow, { onConflict: "id" }));
      }
      if (userError) throw userError;

      syncedBitrixIds.add(bitrixUserId);
      authIdByBitrixId.set(bitrixUserId, authUser.id);
    }
  }

  for (const team of savedTeams) {
    const leaderId = authIdByBitrixId.get(String(team.bitrix_head_user_id ?? ""));
    if (leaderId) {
      const { error } = await supabase.from("equipes").update({ lider_id: leaderId }).eq("id", team.id);
      if (error) throw error;
    }
  }

  const { data: previouslySynced, error: previousError } = await supabase
    .from("usuarios")
    .select("id,bitrix_user_id")
    .in("bitrix_department_id", teamDepartmentIds);
  if (previousError) throw previousError;

  const inactiveIds = (previouslySynced ?? [])
    .filter((user) => user.bitrix_user_id && !syncedBitrixIds.has(user.bitrix_user_id))
    .map((user) => user.id);

  if (inactiveIds.length) {
    const { error } = await supabase.from("usuarios").update({ ativo: false }).in("id", inactiveIds);
    if (error) throw error;
  }

  const { count: corretores } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("perfil", "corretor")
    .eq("ativo", true);

  console.log(JSON.stringify({
    equipes: savedTeams.length,
    usuarios_ativos: syncedBitrixIds.size,
    contas_auth_criadas: created,
    desativados: inactiveIds.length,
    corretores_ativos: corretores ?? 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
