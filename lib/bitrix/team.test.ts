import { beforeEach, describe, expect, it, vi } from "vitest";

const { bitrixCallPage, bitrixCallJson } = vi.hoisted(() => ({
  bitrixCallPage: vi.fn(),
  bitrixCallJson: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bitrix/cache", () => ({
  cached: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
  invalidateCachePrefix: () => {},
}));
vi.mock("@/lib/bitrix/client", () => ({
  bitrixCallPage,
  bitrixCallJson,
  hasBitrixEnv: () => true,
}));

const DEPARTMENTS = [
  { ID: 1, NAME: "HUB", PARENT: null },
  { ID: 442, NAME: "FOCUS", PARENT: 1 },
  { ID: 448, NAME: "FOCUS LÍDER", PARENT: 442 },
  { ID: 454, NAME: "FOCUS TOTAL", PARENT: 442 },
];

const CALLER = { ID: "99", NAME: "Diretora", LAST_NAME: "Focus", EMAIL: "diretora@focus.com", WORK_POSITION: "Diretor", UF_DEPARTMENT: [442], LAST_LOGIN: "2026-08-01T10:00:00+03:00" };
const BROKER_A = { ID: "10", NAME: "Ana", LAST_NAME: "Lima", WORK_POSITION: "Corretor", UF_DEPARTMENT: [448], LAST_LOGIN: "2026-08-01T10:00:00+03:00" };
const BROKER_B = { ID: "20", NAME: "Bruno", LAST_NAME: "Sá", WORK_POSITION: "Corretor", UF_DEPARTMENT: [454], LAST_LOGIN: "2026-08-01T10:00:00+03:00" };
const LEADER = { ID: "30", NAME: "Carla", LAST_NAME: "Melo", WORK_POSITION: "Líder", UF_DEPARTMENT: [454], LAST_LOGIN: "2026-08-01T10:00:00+03:00" };

const STAGES = [
  { STATUS_ID: "C16:NEW", NAME: "Tentativa de Contato", SORT: 10 },
  { STATUS_ID: "C16:EXECUTING", NAME: "Em Atendimento", SORT: 20 },
  { STATUS_ID: "C16:WON", NAME: "Ganho", SORT: 30 },
];

// 50 negócios da Ana (força uma segunda página) + 1 do Bruno.
const OPEN_PAGE_ONE = Array.from({ length: 50 }, (_, index) => ({
  ID: String(index + 1),
  TITLE: `Lead ${index + 1}`,
  STAGE_ID: "C16:NEW",
  CATEGORY_ID: "16",
  ASSIGNED_BY_ID: "10",
  DATE_MODIFY: "2020-01-01T10:00:00+03:00",
  DATE_CREATE: "2020-01-01T10:00:00+03:00",
  // Só os cinco primeiros têm roleta, então só eles podem virar críticos.
  UF_CRM_1726667595972: index < 5 ? "Focus" : "",
}));
const OPEN_PAGE_TWO = [{
  ID: "51",
  TITLE: "Lead do Bruno",
  STAGE_ID: "C16:EXECUTING",
  CATEGORY_ID: "16",
  ASSIGNED_BY_ID: "20",
  DATE_MODIFY: new Date().toISOString(),
  DATE_CREATE: new Date().toISOString(),
  UF_CRM_1726667595972: "",
}];
const CLOSED_DEALS = [{ ID: "60", STAGE_ID: "C16:WON", ASSIGNED_BY_ID: "20" }];

function usersOfDepartment(id: string | null) {
  if (id === "448") return [BROKER_A];
  if (id === "454") return [BROKER_B, LEADER];
  return [];
}

function installHappyPath() {
  bitrixCallJson.mockResolvedValue(STAGES);
  bitrixCallPage.mockImplementation(async (method: string, query?: URLSearchParams) => {
    if (method === "department.get") return { result: DEPARTMENTS };
    if (method === "user.get") {
      if (query?.get("FILTER[EMAIL]")) return { result: [CALLER] };
      return { result: usersOfDepartment(query?.get("FILTER[UF_DEPARTMENT]") ?? null) };
    }
    if (method === "crm.dealcategory.list") return { result: [{ ID: 16, NAME: "Comercial - GERAL" }] };
    if (method === "crm.deal.list") {
      if (query?.get("filter[CLOSED]") === "Y") return { result: CLOSED_DEALS };
      return { result: query?.get("filter[>ID]") === "0" ? OPEN_PAGE_ONE : OPEN_PAGE_TWO };
    }
    return { result: [] };
  });
}

function dealQueries() {
  return bitrixCallPage.mock.calls
    .filter((call) => call[0] === "crm.deal.list")
    .map((call) => call[1] as URLSearchParams);
}

describe("getTeamPipelineForEmail", () => {
  beforeEach(() => {
    bitrixCallPage.mockReset();
    bitrixCallJson.mockReset();
  });

  it("busca os negócios de todos os corretores numa varredura só, sem uma consulta por corretor", async () => {
    installHappyPath();
    const { getTeamPipelineForEmail } = await import("@/lib/bitrix/team");
    const pipeline = await getTeamPipelineForEmail("diretora@focus.com", null, false, { isAdmin: true });

    expect(pipeline.ok).toBe(true);
    // Duas páginas de abertos + uma de fechados. O modelo antigo faria duas consultas por corretor.
    const queries = dealQueries();
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.get("filter[=ASSIGNED_BY_ID]")).toBeNull();
      expect(query.get("start")).toBe("-1");
      expect(query.getAll("filter[@ASSIGNED_BY_ID][0]")).toEqual(["10"]);
      expect(query.getAll("filter[@ASSIGNED_BY_ID][1]")).toEqual(["20"]);
    }
    // Abertos e fechados são varridos em paralelo, então a ordem das chamadas se mistura.
    const openCursors = queries.filter((query) => query.get("filter[CLOSED]") === "N").map((query) => query.get("filter[>ID]"));
    expect(openCursors).toEqual(["0", "50"]);
  });

  it("distribui os negócios da varredura para o corretor certo", async () => {
    installHappyPath();
    const { getTeamPipelineForEmail } = await import("@/lib/bitrix/team");
    const pipeline = await getTeamPipelineForEmail("diretora@focus.com", null, false, { isAdmin: true });

    const ana = pipeline.rows.find((row) => row.user.ID === "10");
    const bruno = pipeline.rows.find((row) => row.user.ID === "20");
    expect(ana?.total).toBe(50);
    expect(bruno?.total).toBe(1);
    expect(ana?.criticos).toBe(5);
    expect(bruno?.criticos).toBe(0);
    expect(bruno?.ganhos).toBe(1);
    expect(pipeline.totals.totalDeals).toBe(51);
    expect(pipeline.totals.criticos).toBe(5);
    // Líder não entra na lista de corretores.
    expect(pipeline.rows.some((row) => row.user.ID === "30")).toBe(false);
  });

  it("devolve erro quando o Bitrix falha, em vez de mostrar zero negócios", async () => {
    installHappyPath();
    bitrixCallPage.mockImplementation(async (method: string, query?: URLSearchParams) => {
      if (method === "department.get") return { result: DEPARTMENTS };
      if (method === "user.get") {
        if (query?.get("FILTER[EMAIL]")) return { result: [CALLER] };
        return { result: usersOfDepartment(query?.get("FILTER[UF_DEPARTMENT]") ?? null) };
      }
      if (method === "crm.dealcategory.list") return { result: [{ ID: 16, NAME: "Comercial - GERAL" }] };
      if (method === "crm.deal.list") {
        throw new Error("O Bitrix24 bloqueou temporariamente esta consulta por excesso de tempo de operação. Tente novamente em alguns minutos.");
      }
      return { result: [] };
    });

    const { getTeamPipelineForEmail } = await import("@/lib/bitrix/team");
    const pipeline = await getTeamPipelineForEmail("diretora@focus.com", null, false, { isAdmin: true });

    expect(pipeline.ok).toBe(false);
    expect(pipeline.error).toContain("bloqueou temporariamente");
    expect(pipeline.rows).toEqual([]);
  });
});
