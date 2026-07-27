import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { z } from "npm:zod@4.4.3";

const webhookSchema = z.object({
  event: z.string().min(1),
  event_id: z.string().min(1).optional(),
  data: z.object({ FIELDS: z.object({ ID: z.coerce.string().min(1) }).passthrough() }).passthrough(),
}).passthrough();

type Payload = z.infer<typeof webhookSchema>;
type JsonRecord = Record<string, unknown>;

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("BITRIX24_WEBHOOK_SECRET") ?? "";
const bitrixBaseUrl = (Deno.env.get("BITRIX24_BASE_URL") ?? "").replace(/\/$/, "");
const categoryId = Deno.env.get("BITRIX24_FILTER_CATEGORY_ID") ?? "36";
const captureCategoryId = Deno.env.get("BITRIX24_CAPTURE_CATEGORY_ID") ?? "16";
const stageId = Deno.env.get("BITRIX24_FILTER_STAGE_ID") ?? "C36:NEW";
const rouletteField = Deno.env.get("BITRIX24_ROULETTE_FIELD") ?? "UF_CRM_1726667595972";
const rouletteTag = Deno.env.get("BITRIX24_ROULETTE_TAG") ?? Deno.env.get("BITRIX24_ROULETTE_SUFFIX") ?? "Focus";
const poolName = Deno.env.get("BITRIX24_POOL_NAME") ?? "Bolsão";
const superintendencyDepartmentId = Deno.env.get("BITRIX24_SUPERINTENDENCY_DEPARTMENT_ID") ?? "444";
const directorateDepartmentId = Deno.env.get("BITRIX24_DIRECTORATE_DEPARTMENT_ID") ?? "442";
const teamDepartmentIds = (Deno.env.get("BITRIX24_TEAM_DEPARTMENT_IDS") ?? "454,448,551")
  .split(",").map((value) => value.trim()).filter(Boolean);
const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

function json(body: JsonRecord, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function safeEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let index = 0; index < a.length; index += 1) different |= a[index] ^ b[index];
  return different === 0;
}

function fromForm(body: string): Payload {
  const form = new URLSearchParams(body);
  return {
    event: form.get("event") ?? "UNKNOWN",
    event_id: form.get("event_id") ?? undefined,
    data: { FIELDS: { ID: form.get("data[FIELDS][ID]") ?? "" } },
  };
}

function rouletteValue(deal: JsonRecord) {
  const value = deal[rouletteField];
  return Array.isArray(value) ? String(value[0] ?? "").trim() : String(value ?? "").trim();
}

function isEligible(deal: JsonRecord) {
  return String(deal.CATEGORY_ID ?? "") === categoryId
    && String(deal.STAGE_ID ?? "") === stageId
    && rouletteValue(deal).toLocaleLowerCase().includes(rouletteTag.toLocaleLowerCase());
}

async function bitrixCall<T>(method: string, params?: URLSearchParams) {
  if (!bitrixBaseUrl) throw new Error("BITRIX24_BASE_URL ausente");
  const url = new URL(`${bitrixBaseUrl}/${method}.json`);
  params?.forEach((value, key) => url.searchParams.append(key, value));

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (response.status === 429 && attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
      continue;
    }
    if (!response.ok) throw new Error(`Bitrix respondeu HTTP ${response.status}`);
    const body = await response.json() as { result?: T; error?: string; error_description?: string; total?: number; next?: number };
    if (body.error || body.result === undefined) throw new Error(body.error_description ?? body.error ?? "Resposta inválida do Bitrix");
    return body;
  }

  throw new Error("Bitrix respondeu HTTP 429");
}

async function loadDeal(payload: Payload) {
  const fields = payload.data.FIELDS as JsonRecord;
  if (fields.CATEGORY_ID && fields.STAGE_ID && fields[rouletteField] !== undefined) return fields;
  return (await bitrixCall<JsonRecord>("crm.deal.get", new URLSearchParams({ ID: String(fields.ID) }))).result!;
}

async function markEventProcessed(eventId: string, reason?: string) {
  const { error } = await supabase.from("webhook_eventos").update({
    processado: true, processado_em: new Date().toISOString(), erro_processamento: reason ?? null,
  }).eq("id", eventId);
  if (error) throw error;
}

function opportunityStatus(deal: JsonRecord, existing?: { corretor_id: string | null; status: string } | null) {
  if (isEligible(deal)) return existing?.corretor_id ? existing.status : "disponivel";
  const semantic = String(deal.STAGE_SEMANTIC_ID ?? "");
  if (semantic === "S") return "convertida";
  if (semantic === "F") return "perdida";
  return existing?.corretor_id ? "em_trabalho" : "perdida";
}

async function upsertRoulette() {
  const { data, error } = await supabase.from("roletas").upsert({
    nome: poolName,
    bitrix_funil_id: `${categoryId}:${stageId}:${rouletteTag.toLocaleLowerCase()}`,
    bitrix_category_id: categoryId,
    bitrix_roleta_valor: rouletteTag,
    descricao: `Negócios em ${stageId} cuja Roleta Atual contém ${rouletteTag}`,
    ativa: true,
  }, { onConflict: "bitrix_funil_id" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function processDeal(deal: JsonRecord) {
  const dealId = String(deal.ID ?? "");
  const { data: existing, error: existingError } = await supabase.from("oportunidades")
    .select("id,corretor_id,status").eq("bitrix_deal_id", dealId).maybeSingle();
  if (existingError) throw existingError;
  if (!isEligible(deal) && !existing) return { imported: false, reason: "fora_do_filtro" };

  if (!isEligible(deal) && existing) {
    const { error } = await supabase.from("oportunidades").update({
      status: opportunityStatus(deal, existing),
      roleta_atual: rouletteValue(deal) || null,
      bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
      bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
      ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
    }).eq("id", existing.id);
    if (error) throw error;
    return { imported: false, reason: "saiu_da_nova_entrada" };
  }

  const value = rouletteValue(deal);
  const rouletteId = await upsertRoulette();
  const { error } = await supabase.from("oportunidades").upsert({
    bitrix_deal_id: dealId,
    roleta_id: rouletteId,
    titulo: String(deal.TITLE ?? `Negocio #${dealId}`),
    valor: Number(deal.OPPORTUNITY ?? 0),
    status: opportunityStatus(deal, existing),
    roleta_atual: value,
    bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
    bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
    data_criacao_bitrix: String(deal.DATE_CREATE ?? "") || null,
    ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
  }, { onConflict: "bitrix_deal_id" });
  if (error) throw error;
  return { imported: true };
}

const dealFields = ["ID", "TITLE", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID", "OPPORTUNITY", "ASSIGNED_BY_ID", "DATE_CREATE", "DATE_MODIFY", rouletteField];

async function fetchEligiblePage(start: number) {
  const params = new URLSearchParams({
    "filter[CATEGORY_ID]": categoryId,
    "filter[STAGE_ID]": stageId,
    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,
    start: String(start),
  });
  dealFields.forEach((field) => params.append("select[]", field));
  return bitrixCall<JsonRecord[]>("crm.deal.list", params);
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function fetchDepartment(id: string) {
  const result = (await bitrixCall<JsonRecord[]>("department.get", new URLSearchParams({ ID: id }))).result!;
  if (!result[0]) throw new Error(`Departamento Bitrix ${id} não encontrado`);
  return result[0];
}

async function validateDepartmentHierarchy(teams: JsonRecord[]) {
  if (teams.some((team) => String(team.PARENT ?? "") !== directorateDepartmentId)) {
    throw new Error("Uma das equipes não pertence à diretoria Focus configurada");
  }
  let current = await fetchDepartment(directorateDepartmentId);
  for (let depth = 0; depth < 10; depth += 1) {
    if (String(current.ID) === superintendencyDepartmentId) return;
    const parentId = String(current.PARENT ?? "");
    if (!parentId) break;
    current = await fetchDepartment(parentId);
  }
  throw new Error("A diretoria Focus não pertence à superintendência configurada");
}

async function fetchActiveTeamUsers(departmentId: string) {
  const users: JsonRecord[] = [];
  let start = 0;
  do {
    const page = await bitrixCall<JsonRecord[]>("user.get", new URLSearchParams({
      "FILTER[UF_DEPARTMENT]": departmentId,
      "FILTER[ACTIVE]": "true",
      start: String(start),
    }));
    users.push(...page.result!);
    if (page.next === undefined) break;
    start = page.next;
  } while (true);
  return users;
}

async function listAuthUsers() {
  const users: Array<{ id: string; email?: string; app_metadata: JsonRecord; user_metadata: JsonRecord }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users.map((user) => ({
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata as JsonRecord,
      user_metadata: user.user_metadata as JsonRecord,
    })));
    if (data.users.length < 1000) break;
  }
  return users;
}

async function synchronizeTeamsAndUsers() {
  const teams = await Promise.all(teamDepartmentIds.map(fetchDepartment));
  await validateDepartmentHierarchy(teams);
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
  const { data: savedTeams, error: teamError } = await supabase.from("equipes")
    .upsert(teamRows, { onConflict: "bitrix_department_id" }).select("id,nome,bitrix_department_id,bitrix_head_user_id");
  if (teamError) throw teamError;
  const authUsers = await listAuthUsers();
  const authByEmail = new Map(authUsers.filter((user) => user.email).map((user) => [user.email!.toLocaleLowerCase(), user]));
  const authByBitrixId = new Map(authUsers.filter((user) => user.app_metadata.bitrix_user_id)
    .map((user) => [String(user.app_metadata.bitrix_user_id), user]));
  const syncedBitrixIds = new Set<string>();
  const authIdByBitrixId = new Map<string, string>();
  let created = 0;

  for (const group of teamUsers) {
    const team = savedTeams?.find((item) => String(item.bitrix_department_id) === group.departmentId);
    if (!team) throw new Error(`Equipe ${group.departmentId} não foi persistida`);
    for (const bitrixUser of group.users) {
      const bitrixUserId = String(bitrixUser.ID ?? "");
      const email = String(bitrixUser.EMAIL ?? "").trim().toLocaleLowerCase();
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
        authUser = {
          id: data.user.id,
          email: data.user.email,
          app_metadata: data.user.app_metadata as JsonRecord,
          user_metadata: data.user.user_metadata as JsonRecord,
        };
        authByEmail.set(email, authUser);
        created += 1;
      } else {
        const currentProfile = String(authUser.app_metadata.perfil ?? "");
        const safeProfile = ["admin", "diretora"].includes(currentProfile) ? currentProfile : profile;
        const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
          app_metadata: { ...authUser.app_metadata, perfil: safeProfile, bitrix_user_id: bitrixUserId },
          user_metadata: { ...authUser.user_metadata, nome: name },
        });
        if (error) throw error;
      }
      const effectiveProfile = ["admin", "diretora"].includes(String(authUser.app_metadata.perfil ?? ""))
        ? String(authUser.app_metadata.perfil) : profile;
      const { error: userError } = await supabase.from("usuarios").upsert({
        id: authUser.id,
        nome: name,
        email,
        perfil: effectiveProfile,
        equipe_id: team.id,
        equipe_nome: team.nome,
        bitrix_user_id: bitrixUserId,
        bitrix_department_id: group.departmentId,
        ativo: true,
      }, { onConflict: "id" });
      if (userError) throw userError;
      syncedBitrixIds.add(bitrixUserId);
      authIdByBitrixId.set(bitrixUserId, authUser.id);
    }
  }

  for (const team of savedTeams ?? []) {
    const leaderId = authIdByBitrixId.get(String(team.bitrix_head_user_id ?? ""));
    if (leaderId) {
      const { error } = await supabase.from("equipes").update({ lider_id: leaderId }).eq("id", team.id);
      if (error) throw error;
    }
  }

  const { data: previouslySynced, error: previousError } = await supabase.from("usuarios")
    .select("id,bitrix_user_id").in("bitrix_department_id", teamDepartmentIds);
  if (previousError) throw previousError;
  const inactiveIds = (previouslySynced ?? []).filter((user) => user.bitrix_user_id && !syncedBitrixIds.has(user.bitrix_user_id)).map((user) => user.id);
  if (inactiveIds.length) {
    const { error } = await supabase.from("usuarios").update({ ativo: false }).in("id", inactiveIds);
    if (error) throw error;
  }

  return {
    equipes: savedTeams?.length ?? 0,
    usuarios_ativos: syncedBitrixIds.size,
    lideres: (savedTeams ?? []).filter((team) => authIdByBitrixId.has(String(team.bitrix_head_user_id ?? ""))).length,
    contas_auth_criadas: created,
    desativados: inactiveIds.length,
  };
}

async function synchronizeEligibleDeals() {
  const first = await fetchEligiblePage(0);
  const total = first.total ?? first.result!.length;
  const starts = Array.from({ length: Math.max(0, Math.ceil(total / 50) - 1) }, (_, index) => (index + 1) * 50);
  const deals = [...first.result!];
  for (let index = 0; index < starts.length; index += 4) {
    const pages = await Promise.all(starts.slice(index, index + 4).map(fetchEligiblePage));
    pages.forEach((page) => deals.push(...page.result!));
  }

  const eligible = deals.filter(isEligible);
  const { data: roulette, error: rouletteError } = await supabase.from("roletas").upsert({
    nome: poolName,
    bitrix_funil_id: `${categoryId}:${stageId}:${rouletteTag.toLocaleLowerCase()}`,
    bitrix_category_id: categoryId,
    bitrix_roleta_valor: rouletteTag,
    descricao: `Negócios em ${stageId} cuja Roleta Atual contém ${rouletteTag}`,
    ativa: true,
  }, { onConflict: "bitrix_funil_id" }).select("id").single();
  if (rouletteError) throw rouletteError;

  const dealIds = eligible.map((deal) => String(deal.ID));
  const existingRows = (await Promise.all(chunks(dealIds, 300).map(async (ids) => {
    const { data, error } = await supabase.from("oportunidades").select("bitrix_deal_id,corretor_id,status").in("bitrix_deal_id", ids);
    if (error) throw error;
    return data ?? [];
  }))).flat();
  const existingOpportunities = new Map(existingRows.map((item) => [item.bitrix_deal_id, item]));

  const opportunities = eligible.map((deal) => {
    const dealId = String(deal.ID);
    const value = rouletteValue(deal);
    return {
      bitrix_deal_id: dealId,
      roleta_id: roulette.id,
      titulo: String(deal.TITLE ?? `Negocio #${dealId}`),
      valor: Number(deal.OPPORTUNITY ?? 0),
      status: opportunityStatus(deal, existingOpportunities.get(dealId)),
      roleta_atual: value,
      bitrix_stage_id: String(deal.STAGE_ID ?? "") || null,
      bitrix_assigned_by_id: String(deal.ASSIGNED_BY_ID ?? "") || null,
      data_criacao_bitrix: String(deal.DATE_CREATE ?? "") || null,
      ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? new Date().toISOString()),
    };
  });
  await Promise.all(chunks(opportunities, 250).map(async (batch) => {
    const { error } = await supabase.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });
    if (error) throw error;
  }));

  return { encontrados: total, importados: eligible.length, ignorados: deals.length - eligible.length, roletas: 1 };
}

function listComercialGeralMonthPeriods(year = Number(Deno.env.get("YEAR") ?? new Date().getFullYear())) {
  const now = new Date();
  const lastMonth = year === now.getFullYear() ? now.getMonth() : 11;
  return Array.from({ length: lastMonth + 1 }, (_, month) => {
    const from = new Date(year, month, 1, 0, 0, 0);
    const to = year === now.getFullYear() && month === now.getMonth()
      ? now
      : new Date(year, month + 1, 0, 23, 59, 59);
    return {
      label: `${year}-${String(month + 1).padStart(2, "0")}`,
      dateFrom: from.toISOString().slice(0, 19),
      dateTo: to.toISOString().slice(0, 19),
    };
  });
}

function isComercialGeralFocus(deal: JsonRecord) {
  return String(deal.CATEGORY_ID ?? "") === captureCategoryId
    && rouletteValue(deal).toLocaleLowerCase().includes(rouletteTag.toLocaleLowerCase());
}

function stageWithSemantic(deal: JsonRecord) {
  const stage = String(deal.STAGE_ID ?? "").trim();
  const semantic = String(deal.STAGE_SEMANTIC_ID ?? "").trim().toUpperCase();
  if (!stage) return semantic ? `#${semantic}` : null;
  if (!semantic) return stage;
  return `${stage}#${semantic}`;
}

async function fetchComercialGeralPage(start: number, dateFrom: string, dateTo: string) {
  const params = new URLSearchParams({
    "filter[CATEGORY_ID]": captureCategoryId,
    [`filter[=%${rouletteField}]`]: `%${rouletteTag}%`,
    "filter[>=DATE_CREATE]": dateFrom,
    "filter[<=DATE_CREATE]": dateTo,
    start: String(start),
  });
  dealFields.forEach((field) => params.append("select[]", field));
  return bitrixCall<JsonRecord[]>("crm.deal.list", params);
}

async function fetchComercialGeralMonthDeals(period: { dateFrom: string; dateTo: string }) {
  const first = await fetchComercialGeralPage(0, period.dateFrom, period.dateTo);
  const total = first.total ?? first.result!.length;
  const starts = Array.from({ length: Math.max(0, Math.ceil(total / 50) - 1) }, (_, index) => (index + 1) * 50);
  const deals = [...first.result!];
  for (const start of starts) {
    const page = await fetchComercialGeralPage(start, period.dateFrom, period.dateTo);
    deals.push(...page.result!);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { total, deals };
}

async function synchronizeComercialGeralDeals() {
  const year = Number(Deno.env.get("YEAR") ?? new Date().getFullYear());
  const months = listComercialGeralMonthPeriods(year);
  const funilId = `${captureCategoryId}:*:${rouletteTag.toLocaleLowerCase()}:dashboard`;
  const { data: roulette, error: rouletteError } = await supabase.from("roletas").upsert({
    nome: "Comercial Geral · Focus",
    bitrix_funil_id: funilId,
    bitrix_category_id: String(captureCategoryId),
    bitrix_roleta_valor: rouletteTag,
    descricao: `Histórico Focus da category ${captureCategoryId} para Visão geral (${year})`,
    ativa: true,
  }, { onConflict: "bitrix_funil_id" }).select("id").single();
  if (rouletteError) throw rouletteError;

  const { data: usuarios, error: usuariosError } = await supabase
    .from("usuarios")
    .select("id, bitrix_user_id")
    .not("bitrix_user_id", "is", null);
  if (usuariosError) throw usuariosError;

  const corretorByBitrixId = new Map(
    (usuarios ?? []).map((usuario) => [String(usuario.bitrix_user_id), usuario.id]),
  );

  let encontrados = 0;
  let baixados = 0;
  let elegiveis = 0;
  let importados = 0;
  let comCorretor = 0;

  for (const period of months) {
    const monthResult = await fetchComercialGeralMonthDeals(period);
    encontrados += monthResult.total;
    baixados += monthResult.deals.length;
    const eligible = monthResult.deals.filter(isComercialGeralFocus);
    elegiveis += eligible.length;
    if (!eligible.length) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }

    const dealIds = eligible.map((deal) => String(deal.ID));
    const existingRows = (await Promise.all(chunks(dealIds, 300).map(async (ids) => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("bitrix_deal_id, roleta_id, corretor_id, captada_em")
        .in("bitrix_deal_id", ids);
      if (error) throw error;
      return data ?? [];
    }))).flat();
    const existingByDeal = new Map(existingRows.map((row) => [row.bitrix_deal_id, row]));

    const opportunities = eligible.map((deal) => {
      const dealId = String(deal.ID);
      const existing = existingByDeal.get(dealId);
      const assigned = String(deal.ASSIGNED_BY_ID ?? "") || null;
      const mappedCorretor = assigned ? corretorByBitrixId.get(assigned) ?? null : null;
      const corretorId = existing?.corretor_id ?? mappedCorretor;
      const dateCreate = String(deal.DATE_CREATE ?? "") || null;
      const captadaEm = existing?.captada_em ?? (corretorId && dateCreate ? dateCreate : null);
      if (corretorId) comCorretor += 1;

      return {
        bitrix_deal_id: dealId,
        roleta_id: existing?.roleta_id ?? roulette.id,
        titulo: String(deal.TITLE ?? `Negócio #${dealId}`),
        valor: Number(deal.OPPORTUNITY ?? 0) || 0,
        roleta_atual: rouletteValue(deal) || null,
        bitrix_stage_id: stageWithSemantic(deal),
        bitrix_assigned_by_id: assigned,
        data_criacao_bitrix: dateCreate,
        ultima_atualizacao_bitrix: String(deal.DATE_MODIFY ?? dateCreate ?? new Date().toISOString()),
        corretor_id: corretorId,
        captada_em: captadaEm,
      };
    });

    await Promise.all(chunks(opportunities, 200).map(async (batch) => {
      const { error } = await supabase.from("oportunidades").upsert(batch, { onConflict: "bitrix_deal_id" });
      if (error) throw error;
      importados += batch.length;
    }));

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const dateFrom = months[0]?.dateFrom ?? "";
  const dateTo = months[months.length - 1]?.dateTo ?? "";

  return {
    categoryId: captureCategoryId,
    periodo: { de: dateFrom, ate: dateTo },
    meses: months.length,
    encontrados,
    baixados,
    elegiveis,
    importados,
    com_corretor: comCorretor,
    roleta_id: roulette.id,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "metodo_nao_permitido" }, 405);
  if (!supabaseUrl || !secretKey || !webhookSecret || !bitrixBaseUrl) return json({ error: "funcao_nao_configurada" }, 503);
  const providedSecret = request.headers.get("x-flow-focus-secret") ?? new URL(request.url).searchParams.get("secret") ?? "";
  if (!(await safeEqual(providedSecret, webhookSecret))) return json({ error: "nao_autorizado" }, 401);

  try {
    const reprocessId = request.headers.get("x-reprocess-event-id");
    if (reprocessId) {
      const { data: existing, error } = await supabase.from("webhook_eventos")
        .select("id,payload_bruto,tentativas").eq("id", reprocessId).eq("processado", false).single();
      if (error || !existing) return json({ error: "evento_nao_encontrado" }, 404);
      const payload = webhookSchema.parse(existing.payload_bruto);
      await supabase.from("webhook_eventos").update({ tentativas: existing.tentativas + 1 }).eq("id", existing.id);
      const result = await processDeal(await loadDeal(payload));
      await markEventProcessed(existing.id, result.reason);
      return json({ ok: true, reprocessado: true, evento_id: existing.id, ...result });
    }

    const raw = await request.text();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const value = JSON.parse(raw) as JsonRecord;
      if (value.action === "sync") return json({ ok: true, ...(await synchronizeEligibleDeals()) });
      if (value.action === "sync_people") return json({ ok: true, ...(await synchronizeTeamsAndUsers()) });
      if (value.action === "sync_comercial_geral") return json({ ok: true, ...(await synchronizeComercialGeralDeals()) });
      if (value.action === "sync_all") return json({
        ok: true,
        pessoas: await synchronizeTeamsAndUsers(),
        oportunidades: await synchronizeEligibleDeals(),
        comercial_geral: await synchronizeComercialGeralDeals(),
      });
    }

    const value = contentType.includes("application/json") ? JSON.parse(raw) : fromForm(raw);
    const payload = webhookSchema.parse(value);
    const key = payload.event_id ?? Array.from(await digest(raw)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: event, error: insertError } = await supabase.from("webhook_eventos").upsert({
      idempotency_key: key, tipo_evento: payload.event, payload_bruto: payload, tentativas: 1,
    }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id,processado").maybeSingle();
    if (insertError) throw insertError;
    if (!event || event.processado) return json({ ok: true, duplicado: true, evento_id: event?.id }, 202);

    try {
      const result = await processDeal(await loadDeal(payload));
      await markEventProcessed(event.id, result.reason);
      return json({ ok: true, evento_id: event.id, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro_desconhecido";
      await supabase.from("webhook_eventos").update({ erro_processamento: message }).eq("id", event.id);
      console.error("Falha ao processar webhook", { eventId: event.id, message });
      return json({ ok: false, evento_id: event.id, reprocessavel: true }, 202);
    }
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "payload_invalido", detalhes: error.issues }, 400);
    console.error("Falha antes da persistencia do webhook", error);
    return json({ error: "erro_interno" }, 500);
  }
});
