import "server-only";

import { cached, invalidateCachePrefix, mapLimit } from "@/lib/bitrix/cache";
import { bitrixCallPage } from "@/lib/bitrix/client";
import { fetchBitrixDealStages } from "@/lib/bitrix/deal-stages";
import type {
  BitrixTeamUser,
  BrokerPipelineRow,
  ExpiringLead,
  ExpiringLeadsMode,
  ExpiringLeadsResult,
  TeamPipeline,
} from "@/lib/types/equipe";

const PIPELINE_NAME = "Comercial - GERAL";
import {
  assessCriticalDeal,
  criticalDeadlineSource,
  isDealQuarantineStatus,
  isDueRdStationLead,
  prazoQuarentenaDate,
  ROULETTE_FIELD,
} from "@/lib/bitrix/team-critical";

type BitrixDeal = {
  ID: string;
  TITLE: string;
  STAGE_ID: string;
  CATEGORY_ID: string;
  ASSIGNED_BY_ID: string;
  DATE_MODIFY: string;
  DATE_CREATE: string;
  SOURCE_ID?: string | null;
  UF_CRM_1717073472?: string | number | null;
  UF_CRM_1726060130?: string | null;
  UF_CRM_1726060110?: string | null;
  UF_CRM_1746557234244?: string | null;
  UF_CRM_1726667595972?: string | null;
};

type RawBitrixUser = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  EMAIL?: string;
  WORK_POSITION?: string;
  PERSONAL_PHOTO?: string;
  UF_DEPARTMENT?: Array<number | string>;
  ACTIVE?: boolean | "Y" | "N";
  LAST_LOGIN?: unknown;
  LAST_ACTIVITY_DATE?: unknown;
  CONFIRM_CODE?: unknown;
};

type Department = { id: number; name: string; parent: number | null };
type RawDepartment = { ID: number | string; NAME: string; PARENT?: number | string | null };

function params(entries: Record<string, string>) {
  return new URLSearchParams(entries);
}

function emptyPipeline(scopeLabel: string, error: string): TeamPipeline {
  return {
    ok: false,
    error,
    scopeLabel,
    categoryId: "",
    categoryName: PIPELINE_NAME,
    departments: [],
    teams: [],
    members: [],
    stages: [],
    rows: [],
    totals: { totalDeals: 0, criticos: 0, stages: {}, stageCriticos: {} },
    updatedAt: new Date().toISOString(),
  };
}


function isLostStage(stageId: string) {
  return /LOSE|PERDID|PRAZO/i.test(stageId);
}

function isWonStage(stageId: string) {
  return /WON/i.test(stageId);
}

function isLeaderish(position: string | null | undefined) {
  return /l[ií]der|diretor|superintend/i.test(position ?? "");
}

function isPendingInvite(user: RawBitrixUser) {
  if (String(user.CONFIRM_CODE ?? "").trim()) return true;
  return !String(user.LAST_LOGIN ?? "").trim() && !String(user.LAST_ACTIVITY_DATE ?? "").trim();
}

function isActiveUser(value: RawBitrixUser["ACTIVE"]) {
  return value !== false && value !== "N";
}

function monthRange(month: string | null | undefined) {
  if (!month) return null;
  if (/^\d{4}$/.test(month)) {
    const year = Number(month);
    return {
      from: new Date(Date.UTC(year, 0, 1)).toISOString(),
      to: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    };
  }
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, numericMonth] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, numericMonth - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, numericMonth, 1)).toISOString(),
  };
}

async function listAllDepartments(): Promise<Department[]> {
  return cached("team:departments", 30 * 60_000, async () => {
    const output: Department[] = [];
    let start = 0;
    for (let page = 0; page < 20; page += 1) {
      const response = await bitrixCallPage<RawDepartment[]>("department.get", params({ start: String(start) }));
      for (const item of response.result) {
        output.push({
          id: Number(item.ID),
          name: item.NAME,
          parent: item.PARENT == null ? null : Number(item.PARENT),
        });
      }
      if (typeof response.next !== "number") break;
      start = response.next;
    }
    return output;
  });
}

function descendantsOf(departments: readonly Department[], roots: readonly number[]) {
  const children = new Map<number, number[]>();
  for (const department of departments) {
    if (department.parent == null) continue;
    children.set(department.parent, [...(children.get(department.parent) ?? []), department.id]);
  }
  const result = new Set<number>();
  const pending = [...roots];
  while (pending.length) {
    const id = pending.pop();
    if (id == null || result.has(id)) continue;
    result.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  return result;
}

async function findBitrixUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return cached(`team:user-email:${normalized}`, 5 * 60_000, async () => {
    const response = await bitrixCallPage<RawBitrixUser[]>(
      "user.get",
      params({ "FILTER[EMAIL]": normalized }),
    );
    return response.result.find((user) => user.EMAIL?.toLowerCase() === normalized) ?? response.result[0] ?? null;
  });
}

async function findBitrixUserById(id: string) {
  const response = await bitrixCallPage<RawBitrixUser[]>("user.get", params({ "FILTER[ID]": id }));
  return response.result[0] ?? null;
}

async function listUsersInDepartments(departmentIds: readonly number[]): Promise<BitrixTeamUser[]> {
  const sortedIds = [...departmentIds].sort((a, b) => a - b);
  return cached(`team:users:${sortedIds.join(",")}`, 5 * 60_000, async () => {
    const departments = await listAllDepartments();
    const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
    const users = new Map<string, BitrixTeamUser>();

    for (const departmentId of sortedIds) {
      let start = 0;
      for (let page = 0; page < 10; page += 1) {
        const response = await bitrixCallPage<RawBitrixUser[]>(
          "user.get",
          params({ "FILTER[UF_DEPARTMENT]": String(departmentId), start: String(start) }),
        );
        for (const raw of response.result) {
          if (users.has(raw.ID) || isPendingInvite(raw)) continue;
          const departmentIdsForUser = (raw.UF_DEPARTMENT ?? []).map(Number);
          const scopeDepartment = departmentIdsForUser.find((id) => sortedIds.includes(id));
          users.set(raw.ID, {
            ID: raw.ID,
            NAME: raw.NAME ?? "",
            LAST_NAME: raw.LAST_NAME ?? "",
            fullName: [raw.NAME, raw.LAST_NAME].filter(Boolean).join(" ").trim() || `ID ${raw.ID}`,
            photo: raw.PERSONAL_PHOTO ?? null,
            workPosition: raw.WORK_POSITION ?? null,
            email: raw.EMAIL ?? null,
            departmentIds: departmentIdsForUser,
            active: isActiveUser(raw.ACTIVE),
            teamName: scopeDepartment == null ? null : departmentNames.get(scopeDepartment) ?? null,
          });
        }
        if (typeof response.next !== "number") break;
        start = response.next;
      }
    }
    return [...users.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
  });
}

async function resolvePipeline() {
  return cached("team:pipeline", 30 * 60_000, async () => {
    const fallbackId = process.env.BITRIX24_CAPTURE_CATEGORY_ID ?? "16";
    try {
      const response = await bitrixCallPage<Array<{ ID: string | number; NAME: string }>>(
        "crm.dealcategory.list",
        params({ start: "-1" }),
      );
      const normalized = PIPELINE_NAME.toLowerCase();
      const match = response.result.find((category) => category.NAME.trim().toLowerCase() === normalized)
        ?? response.result.find((category) => category.NAME.toLowerCase().includes(normalized));
      if (match) return { id: String(match.ID), name: match.NAME };
    } catch {
      // O ID configurado é a fonte de recuperação quando o endpoint de categorias falha.
    }
    return { id: fallbackId, name: PIPELINE_NAME };
  });
}

async function getPipelineStages(categoryId: string) {
  return cached(`team:stages:${categoryId}`, 10 * 60_000, async () => {
    const stages = await fetchBitrixDealStages(categoryId);
    return stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
    }));
  });
}

const DEALS_CACHE_TTL_MS = 60_000;

async function listDeals(
  userId: string,
  categoryId: string,
  options: { closed: boolean; month?: string | null; fresh?: boolean },
) {
  const range = monthRange(options.month);
  const cacheKey = `team:deals:${categoryId}:${userId}:${options.closed ? "closed" : "open"}:${options.month ?? "all"}`;
  if (options.fresh) invalidateCachePrefix(cacheKey);
  return cached(cacheKey, DEALS_CACHE_TTL_MS, async () => {
    const output: BitrixDeal[] = [];
    let start = 0;
    for (let page = 0; page < 40; page += 1) {
      const query: Record<string, string> = {
        "filter[=ASSIGNED_BY_ID]": userId,
        "filter[=CATEGORY_ID]": categoryId,
        "filter[CLOSED]": options.closed ? "Y" : "N",
        start: String(start),
        "order[ID]": "ASC",
      };
      const fields = options.closed
        ? ["ID", "STAGE_ID"]
        : [
            "ID", "TITLE", "STAGE_ID", "CATEGORY_ID", "ASSIGNED_BY_ID", "DATE_MODIFY", "DATE_CREATE",
            "SOURCE_ID", "UF_CRM_1717073472", "UF_CRM_1726060130", "UF_CRM_1726060110",
            "UF_CRM_1746557234244", ROULETTE_FIELD,
          ];
      fields.forEach((field, index) => { query[`select[${index}]`] = field; });
      if (range) {
        query["filter[>=DATE_CREATE]"] = range.from;
        query["filter[<DATE_CREATE]"] = range.to;
      }
      const response = await bitrixCallPage<BitrixDeal[]>("crm.deal.list", params(query), 20_000);
      output.push(...response.result);
      if (typeof response.next !== "number") break;
      start = response.next;
    }
    return output;
  });
}

function focusRootIds(allDepartments: readonly Department[]) {
  const focus = allDepartments.find((department) => department.name.trim().toUpperCase() === "FOCUS");
  if (focus) return [focus.id];
  const directorateId = Number(process.env.BITRIX24_DIRECTORATE_DEPARTMENT_ID ?? "442");
  if (allDepartments.some((department) => department.id === directorateId)) return [directorateId];
  throw new Error("Não foi possível identificar a raiz Focus no Bitrix24.");
}

function departmentsToTargets(allDepartments: readonly Department[], allowedIds: ReadonlySet<number>) {
  const byId = new Map(allDepartments.map((department) => [department.id, department]));
  return [...allowedIds]
    .map((id) => byId.get(id))
    .filter((department): department is Department => Boolean(department))
    .filter((department) => department.name.trim().toUpperCase() !== "FOCUS")
    .map(({ id, name }) => ({ id, name }));
}

function leafDepartmentIds(allDepartments: readonly Department[], allowedIds: ReadonlySet<number>) {
  const parentsInScope = new Set<number>();
  for (const department of allDepartments) {
    if (department.parent != null && allowedIds.has(department.id)) {
      parentsInScope.add(department.parent);
    }
  }
  return new Set([...allowedIds].filter((id) => !parentsInScope.has(id)));
}

function scopeForAdmin(allDepartments: readonly Department[]) {
  const focusTree = descendantsOf(allDepartments, focusRootIds(allDepartments));
  const teamIds = leafDepartmentIds(allDepartments, focusTree);
  const targets = departmentsToTargets(allDepartments, teamIds);
  if (!targets.length) throw new Error("Nenhum departamento acessível foi encontrado no Bitrix24.");
  return { targets, scopeLabel: "Focus · Todas as equipes" };
}

function scopeForUser(user: RawBitrixUser, allDepartments: readonly Department[]) {
  const ownIds = (user.UF_DEPARTMENT ?? []).map(Number);
  if (!ownIds.length) throw new Error("Seu usuário do Bitrix24 não está vinculado a um departamento.");
  const broadScope = /superintend|diretor/i.test(user.WORK_POSITION ?? "");
  const allowedIds = broadScope ? descendantsOf(allDepartments, ownIds) : new Set(ownIds);
  const byId = new Map(allDepartments.map((department) => [department.id, department]));
  const targets = departmentsToTargets(allDepartments, allowedIds);

  const callerName = `${user.NAME ?? ""} ${user.LAST_NAME ?? ""}`.toLowerCase();
  const restricted = callerName.includes("ismênia") || callerName.includes("ismenia")
    ? targets.filter((target) => ["focus líder", "focus lider", "focus elite", "focus total"].includes(target.name.toLowerCase()))
    : targets;
  const scopeLabel = ownIds.map((id) => byId.get(id)?.name).filter(Boolean).join(" · ") || "Equipe";
  if (!restricted.length) throw new Error("Nenhum departamento acessível foi encontrado no Bitrix24.");
  return { targets: restricted, scopeLabel };
}

function resolveScope(user: RawBitrixUser, allDepartments: readonly Department[], isAdmin: boolean) {
  return isAdmin ? scopeForAdmin(allDepartments) : scopeForUser(user, allDepartments);
}

async function buildTeamPipeline(
  departments: Array<{ id: number; name: string }>,
  scopeLabel: string,
  month: string | null,
  fresh = false,
): Promise<TeamPipeline> {
  const pipeline = await resolvePipeline();
  const [members, stages] = await Promise.all([
    listUsersInDepartments(departments.map((department) => department.id)),
    getPipelineStages(pipeline.id),
  ]);
  const brokers = members.filter((member) => !isLeaderish(member.workPosition));
  const lostStages = new Set(stages.filter((stage) => /perdid|prazo/i.test(stage.name) || /LOSE/i.test(stage.id)).map((stage) => stage.id));
  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const results = await mapLimit(brokers, brokers.length > 20 ? 3 : 6, async (user) => {
    const [openDeals, closedDeals] = await Promise.all([
      listDeals(user.ID, pipeline.id, { closed: false, month, fresh }).catch(() => []),
      listDeals(user.ID, pipeline.id, { closed: true, month, fresh }).catch(() => []),
    ]);
    return { user, openDeals, closedDeals };
  });

  const stageTotals: Record<string, number> = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
  const stageCriticos: Record<string, number> = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
  const rows: BrokerPipelineRow[] = [];
  let totalDeals = 0;
  let totalCriticos = 0;

  for (const { user, openDeals, closedDeals } of results) {
    const counts: Record<string, number> = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
    const criticalCounts: Record<string, number> = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
    let perdidos = 0;
    let ganhos = 0;
    for (const deal of closedDeals) {
      counts[deal.STAGE_ID] = (counts[deal.STAGE_ID] ?? 0) + 1;
      if (isWonStage(deal.STAGE_ID)) ganhos += 1;
      else perdidos += 1;
    }
    let criticos = 0;
    let quarentena = 0;
    for (const deal of openDeals) {
      counts[deal.STAGE_ID] = (counts[deal.STAGE_ID] ?? 0) + 1;
      if (isDealQuarantineStatus(deal.UF_CRM_1717073472)) quarentena += 1;
      const stageName = stageNames.get(deal.STAGE_ID) ?? "";
      const assessment = assessCriticalDeal(deal, stageName, {
        lostStage: isLostStage(deal.STAGE_ID) || lostStages.has(deal.STAGE_ID),
      });
      if (assessment.critical) {
        criticos += 1;
        criticalCounts[deal.STAGE_ID] = (criticalCounts[deal.STAGE_ID] ?? 0) + 1;
      }
    }
    Object.entries(counts).forEach(([stageId, count]) => {
      stageTotals[stageId] = (stageTotals[stageId] ?? 0) + count;
    });
    Object.entries(criticalCounts).forEach(([stageId, count]) => {
      stageCriticos[stageId] = (stageCriticos[stageId] ?? 0) + count;
    });
    totalDeals += openDeals.length;
    totalCriticos += criticos;
    rows.push({
      user,
      total: openDeals.length,
      criticos,
      quarentena,
      perdidos,
      ganhos,
      totalRelevante: openDeals.length,
      expirando: criticos,
      stages: stages.map((stage) => ({
        stageId: stage.id,
        name: stage.name,
        count: counts[stage.id] ?? 0,
        criticos: criticalCounts[stage.id] ?? 0,
        color: stage.color,
      })),
    });
  }

  rows.sort((a, b) => b.total - a.total || a.user.fullName.localeCompare(b.user.fullName, "pt-BR"));
  const teams = departments.map((department) => ({
    ...department,
    count: brokers.filter((broker) => broker.teamName === department.name).length,
  })).sort((a, b) => b.count - a.count);

  return {
    ok: true,
    scopeLabel,
    categoryId: pipeline.id,
    categoryName: pipeline.name,
    departments,
    teams,
    members,
    stages,
    rows,
    totals: { totalDeals, criticos: totalCriticos, stages: stageTotals, stageCriticos },
    updatedAt: new Date().toISOString(),
  };
}

export async function getTeamPipelineForEmail(
  email: string,
  month: string | null,
  fresh = false,
  options?: { isAdmin?: boolean },
): Promise<TeamPipeline> {
  if (!email) return emptyPipeline("Equipe", "Sua sessão não possui um e-mail válido.");
  try {
    const [caller, departments] = await Promise.all([findBitrixUserByEmail(email), listAllDepartments()]);
    if (!caller) return emptyPipeline("Equipe", "Seu e-mail não foi encontrado entre os usuários do Bitrix24.");
    const scope = resolveScope(caller, departments, options?.isAdmin === true);
    return await buildTeamPipeline(scope.targets, scope.scopeLabel, monthRange(month) ? month : null, fresh);
  } catch (error) {
    return emptyPipeline("Equipe", error instanceof Error ? error.message : "Não foi possível consultar o Bitrix24.");
  }
}

async function getSourceNameMap() {
  return cached("team:sources", 10 * 60_000, async () => {
    const response = await bitrixCallPage<Array<{ STATUS_ID: string; NAME: string }>>(
      "crm.status.list",
      params({ "filter[ENTITY_ID]": "SOURCE" }),
    );
    return Object.fromEntries(response.result.map((source) => [source.STATUS_ID, source.NAME]));
  });
}

export async function getExpiringLeadsForEmail(
  email: string,
  brokerId: string,
  mode: ExpiringLeadsMode = "critical",
  fresh = false,
  options?: { isAdmin?: boolean },
): Promise<ExpiringLeadsResult> {
  const failed = (error: string): ExpiringLeadsResult => ({
    ok: false,
    error,
    brokerId,
    items: [],
    updatedAt: new Date().toISOString(),
  });
  try {
    if (!brokerId) return failed("Corretor não informado.");
    const [caller, departments, broker] = await Promise.all([
      findBitrixUserByEmail(email),
      listAllDepartments(),
      findBitrixUserById(brokerId),
    ]);
    if (!caller) return failed("Seu e-mail não foi encontrado no Bitrix24.");
    if (!broker) return failed("Corretor não encontrado no Bitrix24.");
    const scope = resolveScope(caller, departments, options?.isAdmin === true);
    const allowed = new Set(scope.targets.map((department) => department.id));
    if (!(broker.UF_DEPARTMENT ?? []).map(Number).some((id) => allowed.has(id))) {
      return failed("Acesso negado: o corretor está fora do seu escopo.");
    }

    const pipeline = await resolvePipeline();
    const [deals, stages, sourceNames] = await Promise.all([
      listDeals(brokerId, pipeline.id, { closed: false, fresh }),
      getPipelineStages(pipeline.id),
      getSourceNameMap().catch(() => ({} as Record<string, string>)),
    ]);
    const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
    const lostStages = new Set(stages.filter((stage) => /perdid|prazo/i.test(stage.name) || /LOSE/i.test(stage.id)).map((stage) => stage.id));
    const now = Date.now();
    const items: ExpiringLead[] = [];

    for (const deal of deals) {
      if (isWonStage(deal.STAGE_ID) || isLostStage(deal.STAGE_ID) || lostStages.has(deal.STAGE_ID)) continue;

      const stageName = stageNames.get(deal.STAGE_ID) ?? "";
      const inQuarantine = isDealQuarantineStatus(deal.UF_CRM_1717073472);
      if (mode === "quarantine" && !inQuarantine) continue;
      if (mode === "critical" && inQuarantine) continue;

      const assessment = assessCriticalDeal(deal, stageName, { lostStage: false, now });
      if (mode === "critical" && !assessment.critical) continue;

      const sourceName = deal.SOURCE_ID ? sourceNames[deal.SOURCE_ID] ?? null : null;
      const expiringSoon = assessment.expiringSoon;
      const stagnant = assessment.stagnant;
      const quarantineDeadline = inQuarantine ? prazoQuarentenaDate(deal) : null;
      const displayDeadline = mode === "quarantine"
        ? quarantineDeadline
        : expiringSoon
          ? assessment.deadline
          : null;
      const deadlineSource = displayDeadline
        ? mode === "quarantine"
          ? "quarentena"
          : criticalDeadlineSource(deal, stageName)
        : null;
      const msRemaining = displayDeadline ? displayDeadline.getTime() - now : 0;
      items.push({
        dealId: deal.ID,
        title: deal.TITLE || `Negócio ${deal.ID}`,
        stageName: stageName || null,
        deadline: displayDeadline ? displayDeadline.toISOString() : null,
        deadlineSource,
        isQuarantine: inQuarantine,
        msRemaining,
        daysStagnated: assessment.daysStagnated,
        reason: expiringSoon && stagnant ? "prazo-e-sem-movimentacao" : expiringSoon ? "prazo" : "sem-movimentacao",
        justification: inQuarantine ? String(deal.UF_CRM_1746557234244 ?? "").trim() || null : null,
        sourceName,
        isDueRdStation: isDueRdStationLead({
          title: deal.TITLE,
          sourceName,
          roletaAtual: deal[ROULETTE_FIELD as keyof BitrixDeal] as string | null | undefined,
        }),
        isRecentlyCreated: false,
      });
    }

    items.sort((a, b) => {
      if (Boolean(a.deadline) !== Boolean(b.deadline)) return a.deadline ? -1 : 1;
      if (a.deadline && b.deadline) return a.msRemaining - b.msRemaining;
      return b.daysStagnated - a.daysStagnated;
    });
    return { ok: true, brokerId, items, updatedAt: new Date().toISOString() };
  } catch (error) {
    return failed(error instanceof Error ? error.message : `Não foi possível consultar os leads ${mode === "quarantine" ? "em quarentena" : "críticos"}.`);
  }
}
