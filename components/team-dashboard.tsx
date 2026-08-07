"use client";

/* Tela independente /equipe. Estrutura portada de equipe-export/source/team.tsx. */
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownWideNarrow,
  Ban,
  Calendar,
  CheckCircle2,
  Filter,
  PauseCircle,
  RefreshCw,
  Search,
  Timer,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { ExpiringLeadsDialog } from "@/components/expiring-leads-dialog";
import { isLostStageName, TeamStageChart } from "@/components/team-stage-chart";
import { UserAvatar } from "@/components/user-avatar";
import { loadBrokerExemptions, loadTeamPipeline } from "@/lib/actions/equipe";
import type { BrokerPipelineRow, ExpiringLeadsMode } from "@/lib/types/equipe";

type BitrixFilter = "ativo" | "inativo" | "todos";
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = currentYear > 2025 ? [currentYear, 2025] : [2025];
  return years.flatMap((year) => Array.from(
    { length: year === currentYear ? now.getMonth() + 1 : 12 },
    (_, index) => ({ year, month: index + 1 }),
  ));
}

function matchesSearch(row: BrokerPipelineRow, query: string) {
  if (!query) return true;
  const haystack = `${row.user.fullName} ${row.user.teamName ?? ""} ${row.user.workPosition ?? ""} ${row.user.ID}`.toLowerCase();
  return haystack.includes(query);
}

function compareBrokers(a: BrokerPipelineRow, b: BrokerPipelineRow, sortByCritical: boolean) {
  if (sortByCritical && b.criticos !== a.criticos) return b.criticos - a.criticos;
  return a.user.fullName.localeCompare(b.user.fullName, "pt-BR");
}

function TeamTag({ name, count, compact = false }: { name: string; count?: number; compact?: boolean }) {
  return (
    <span className={compact ? "export-team-tag is-compact" : "export-team-tag"}>
      <span>{name}</span>{count != null ? <strong>{count}</strong> : null}
    </span>
  );
}

function BitrixStatusTag({ active }: { active: boolean }) {
  return (
    <span className={`export-status-tag${active ? " is-active" : " is-inactive"}`}>
      {active ? <UserCheck size={11} aria-hidden="true" /> : <UserX size={11} aria-hidden="true" />}
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function groupBrokersByTeam(
  rows: readonly BrokerPipelineRow[],
  excludeIds: ReadonlySet<string>,
  sortByCritical: boolean,
) {
  const map = new Map<string, BrokerPipelineRow[]>();
  for (const row of rows) {
    if (excludeIds.has(row.user.ID)) continue;
    const name = row.user.teamName ?? "Sem equipe";
    map.set(name, [...(map.get(name) ?? []), row]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([name, groupRows]) => [name, [...groupRows].sort((a, b) => compareBrokers(a, b, sortByCritical))] as const);
}

function BrokerTeamGroups({
  groups,
  exempt,
  onOpenCritical,
  onOpenQuarantine,
}: {
  groups: ReturnType<typeof groupBrokersByTeam>;
  exempt: boolean;
  onOpenCritical: (row: BrokerPipelineRow) => void;
  onOpenQuarantine: (row: BrokerPipelineRow) => void;
}) {
  return groups.map(([name, groupRows]) => (
    <section className="export-team-group" key={name}>
      <header><Users size={16} aria-hidden="true" /><h3>{name}</h3><span className="export-team-count">{groupRows.length}</span></header>
      <div>
        {groupRows.map((row) => (
          <BrokerCard
            row={row}
            exempt={exempt}
            key={row.user.ID}
            onOpenCritical={() => onOpenCritical(row)}
            onOpenQuarantine={() => onOpenQuarantine(row)}
          />
        ))}
      </div>
    </section>
  ));
}

function defaultMonthFilter() {
  return String(new Date().getFullYear());
}

function parseMonthValue(value: string) {
  const years = monthOptions().map((option) => option.year);
  const fallbackYear = years.length ? Math.max(...years) : new Date().getFullYear();
  if (value === "__all__") return { year: 0, month: 0, monthYear: fallbackYear };
  if (/^\d{4}$/.test(value)) return { year: Number(value), month: 0, monthYear: Number(value) };
  const [year, month] = value.split("-").map(Number);
  return { year, month, monthYear: year };
}

function MonthFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = useMemo(() => monthOptions(), []);
  const { year: selectedYear, month: selectedMonth, monthYear } = parseMonthValue(value);
  const years = [...new Set(options.map((option) => option.year))].sort((a, b) => b - a);
  const months = options
    .filter((option) => option.year === monthYear)
    .map((option) => option.month)
    .sort((a, b) => a - b);
  function emit(year: number, month: number) {
    if (!year) return onChange("__all__");
    if (!month) return onChange(String(year));
    const available = options.filter((option) => option.year === year).map((option) => option.month);
    const safeMonth = available.includes(month) ? month : available[0] ?? month;
    onChange(`${year}-${String(safeMonth).padStart(2, "0")}`);
  }
  return (
    <div className="export-team-month" title="O período filtra ganhos, perdidos e prazos pela data de criação. As etapas do funil sempre mostram a situação atual.">
      <Calendar size={14} aria-hidden="true" />
      <select value={selectedMonth} onChange={(event) => emit(monthYear, Number(event.target.value))} aria-label="Mês">
        <option value={0}>Todos os meses</option>
        {months.map((month) => <option value={month} key={month}>{MONTH_NAMES[month - 1]}</option>)}
      </select>
      <select value={selectedYear} onChange={(event) => emit(Number(event.target.value), selectedMonth)} aria-label="Ano">
        <option value={0}>Todos os anos</option>
        {years.map((year) => <option value={year} key={year}>{year}</option>)}
      </select>
    </div>
  );
}

function LostStageTag({ name, count }: { name: string; count: number }) {
  const isPrazo = name.toLowerCase().includes("prazo");
  return (
    <span className={`export-lost-tag${count ? "" : " is-empty"}${isPrazo ? " is-prazo" : ""}`}>
      <span>{name}</span>
      <strong>{count}</strong>
    </span>
  );
}

function BrokerCard({
  row,
  exempt,
  onOpenCritical,
  onOpenQuarantine,
}: {
  row: BrokerPipelineRow;
  exempt: boolean;
  onOpenCritical: () => void;
  onOpenQuarantine: () => void;
}) {
  const pipelineStages = row.stages.filter((stage) => !isLostStageName(stage.name));
  const lostStages = row.stages.filter((stage) => isLostStageName(stage.name));
  const criticalById = Object.fromEntries(pipelineStages.map((stage) => [stage.stageId, stage.criticos]));
  const criticalLabel = row.criticos
    ? `Ver ${row.criticos} ${row.criticos === 1 ? "lead crítico" : "leads críticos"} de ${row.user.fullName}`
    : `${row.user.fullName} não tem leads críticos no momento`;
  const quarantineLabel = row.quarentena
    ? `Ver ${row.quarentena} ${row.quarentena === 1 ? "lead em quarentena" : "leads em quarentena"} de ${row.user.fullName}`
    : `${row.user.fullName} não tem leads em quarentena no momento`;

  return (
    <article className={`export-broker-card${!row.user.active ? " is-inactive" : ""}`}>
      <div className="export-broker-head">
        <UserAvatar name={row.user.fullName} photoUrl={row.user.photo} className="export-broker-avatar" />
        <div className="export-broker-copy">
          <div className="export-broker-name">
            <strong>{row.user.fullName}</strong>
            <BitrixStatusTag active={row.user.active} />
            {row.user.teamName ? <TeamTag name={row.user.teamName} compact /> : null}
          </div>
          <p>{row.user.workPosition || "Corretor(a)"} · ID {row.user.ID}</p>
          {exempt ? (
            <div className="export-broker-badges">
              <span className="is-exempt"><Ban size={12} />Dispensado da ferramenta</span>
            </div>
          ) : null}
        </div>
        <div className="export-broker-total"><strong>{row.total}</strong><span>negócios</span>{row.criticos ? <em>{row.criticos} críticos</em> : null}</div>
      </div>
      <div className="export-broker-chart">
        <TeamStageChart
          compact
          criticalById={criticalById}
          stages={pipelineStages.map((stage) => ({
            id: stage.stageId,
            name: stage.name,
            count: stage.count,
            color: stage.color,
          }))}
        />
        {lostStages.length ? <div className="export-lost-list">{lostStages.map((stage) => <LostStageTag key={stage.stageId} name={stage.name} count={stage.count} />)}</div> : null}
      </div>
      <footer>
        <div className="export-broker-footer-meta">
          {row.criticos ? <span className="has-critical"><AlertTriangle size={14} aria-hidden="true" />{row.criticos} críticos</span> : <span className="has-positive"><CheckCircle2 size={14} aria-hidden="true" />Sem críticos</span>}
          {row.quarentena ? <span className="has-quarantine"><PauseCircle size={14} aria-hidden="true" />{row.quarentena} em quarentena</span> : null}
        </div>
        <div className="export-broker-footer-actions">
          <button
            className={row.criticos ? "button button-primary" : "button button-secondary"}
            type="button"
            onClick={onOpenCritical}
            disabled={!row.criticos}
            aria-label={criticalLabel}
          >
            <Timer size={14} aria-hidden="true" />
            Leads Críticos
          </button>
          <button
            className={row.quarentena ? "button button-primary" : "button button-secondary"}
            type="button"
            onClick={onOpenQuarantine}
            disabled={!row.quarentena}
            aria-label={quarantineLabel}
          >
            <PauseCircle size={14} aria-hidden="true" />
            Quarentena
          </button>
        </div>
      </footer>
    </article>
  );
}

export function TeamDashboard() {
  const [month, setMonth] = useState(defaultMonthFilter);
  const [bitrixFilter, setBitrixFilter] = useState<BitrixFilter>("todos");
  const [department, setDepartment] = useState("__all__");
  const [search, setSearch] = useState("");
  const [sortByCritical, setSortByCritical] = useState(false);
  const [leadsDialog, setLeadsDialog] = useState<{ id: string; name: string; mode: ExpiringLeadsMode } | null>(null);
  const closeDialog = useCallback(() => setLeadsDialog(null), []);
  const forceFreshRef = useRef(false);
  const query = useQuery({
    queryKey: ["team-pipeline-current-user", month],
    queryFn: async () => {
      const fresh = forceFreshRef.current;
      forceFreshRef.current = false;
      return loadTeamPipeline(month === "__all__" ? null : month, fresh);
    },
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  const exemptionQuery = useQuery({ queryKey: ["broker-exemptions"], queryFn: loadBrokerExemptions, staleTime: 5 * 60_000 });
  const data = query.data;
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const stages = useMemo(() => data?.stages ?? [], [data?.stages]);
  const exemptIds = useMemo(() => new Set((exemptionQuery.data?.items ?? []).map((item) => item.bitrix_id)), [exemptionQuery.data]);
  const departments = useMemo(() => [...new Set(rows.map((row) => row.user.teamName ?? "Sem equipe"))].sort(), [rows]);
  const searchNormalized = search.trim().toLowerCase();

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (bitrixFilter === "ativo" && !row.user.active) return false;
    if (bitrixFilter === "inativo" && row.user.active) return false;
    if (department !== "__all__" && (row.user.teamName ?? "Sem equipe") !== department) return false;
    return matchesSearch(row, searchNormalized);
  }), [bitrixFilter, department, rows, searchNormalized]);

  const activeRows = useMemo(() => filteredRows.filter((row) => !exemptIds.has(row.user.ID)), [filteredRows, exemptIds]);
  const exemptRows = useMemo(
    () => [...filteredRows.filter((row) => exemptIds.has(row.user.ID))].sort((a, b) => compareBrokers(a, b, sortByCritical)),
    [filteredRows, exemptIds, sortByCritical],
  );

  const aggregates = useMemo(() => {
    const totals = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
    const critical = Object.fromEntries(stages.map((stage) => [stage.id, 0]));
    for (const row of filteredRows) for (const stage of row.stages) {
      totals[stage.stageId] = (totals[stage.stageId] ?? 0) + stage.count;
      critical[stage.stageId] = (critical[stage.stageId] ?? 0) + stage.criticos;
    }
    return { totals, critical };
  }, [filteredRows, stages]);

  const priorityRows = useMemo(
    () => [...activeRows]
      .filter((row) => row.criticos > 0)
      .sort((a, b) => b.criticos - a.criticos || compareBrokers(a, b, false))
      .slice(0, 3),
    [activeRows],
  );

  const priorityIds = useMemo(() => new Set(priorityRows.map((row) => row.user.ID)), [priorityRows]);

  const activeBrokerRows = useMemo(() => activeRows.filter((row) => row.user.active), [activeRows]);
  const inactiveBrokerRows = useMemo(() => activeRows.filter((row) => !row.user.active), [activeRows]);

  const activeGroups = useMemo(
    () => groupBrokersByTeam(activeBrokerRows, priorityIds, sortByCritical),
    [activeBrokerRows, priorityIds, sortByCritical],
  );
  const inactiveGroups = useMemo(
    () => groupBrokersByTeam(inactiveBrokerRows, priorityIds, sortByCritical),
    [inactiveBrokerRows, priorityIds, sortByCritical],
  );

  const filtersActive = bitrixFilter !== "todos" || department !== "__all__" || month !== defaultMonthFilter() || searchNormalized.length > 0;

  const resetFilters = useCallback(() => {
    setBitrixFilter("todos");
    setDepartment("__all__");
    setMonth(defaultMonthFilter());
    setSearch("");
    setSortByCritical(false);
  }, []);

  const openBrokerLeads = useCallback((row: BrokerPipelineRow, mode: ExpiringLeadsMode) => {
    setLeadsDialog({ id: row.user.ID, name: row.user.fullName, mode });
  }, []);

  const refreshTeam = useCallback(() => {
    forceFreshRef.current = true;
    void query.refetch();
  }, [query]);

  return (
    <div className="export-team-page">
      <header className="export-team-header">
        <div><p>Equipe · Bitrix24 · sincronização automática</p><h1>{data?.scopeLabel ?? "Equipe"} · Pipeline {data?.categoryName ?? "Comercial - GERAL"}</h1><span>{rows.length} corretor(es) · {data?.totals.totalDeals ?? 0} negócios em andamento</span></div>
        <button className="button button-secondary" type="button" onClick={refreshTeam} disabled={query.isFetching} aria-busy={query.isFetching}>
          <RefreshCw className={query.isFetching ? "is-spinning" : ""} size={15} aria-hidden="true" />
          Atualizar
        </button>
      </header>
      <span className="sr-only" aria-live="polite">{query.isFetching ? "Atualizando dados da equipe." : ""}</span>

      {data?.ok ? (
        <>
          <section className="export-card export-team-filters">
            <div className="export-filter-label"><Filter size={14} aria-hidden="true" />Filtros:</div>
            <select value={bitrixFilter} onChange={(event) => setBitrixFilter(event.target.value as BitrixFilter)} aria-label="Status no Bitrix">
              <option value="todos">Bitrix: todos</option>
              <option value="ativo">Ativo no Bitrix</option>
              <option value="inativo">Inativo no Bitrix</option>
            </select>
            <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Departamento">
              <option value="__all__">Todos os departamentos</option>
              {departments.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <MonthFilter value={month} onChange={setMonth} />
            <span>Mostrando {filteredRows.length} de {rows.length} corretor(es)</span>
          </section>

          <section className="export-card export-team-triage">
            <label className="export-team-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar corretor, equipe ou ID"
                aria-label="Buscar corretor"
              />
            </label>
            <button
              className={`button button-secondary export-sort-toggle${sortByCritical ? " is-active" : ""}`}
              type="button"
              aria-pressed={sortByCritical}
              onClick={() => setSortByCritical((value) => !value)}
            >
              <ArrowDownWideNarrow size={14} aria-hidden="true" />
              Ordenar por críticos
            </button>
          </section>
        </>
      ) : null}

      {query.isLoading ? (
        <section className="export-card export-loading">
          <RefreshCw className="is-spinning" size={24} aria-hidden="true" />
          <strong>Carregando equipe do Bitrix24…</strong>
          <p>Buscando corretores e distribuição do pipeline.</p>
        </section>
      ) : null}

      {data && !data.ok ? (
        <section className="export-card export-error">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <strong>Não foi possível carregar a equipe.</strong>
            <p>{data.error}</p>
            <button className="button button-secondary" type="button" onClick={refreshTeam} disabled={query.isFetching}>
              Tentar de novo
            </button>
          </div>
        </section>
      ) : null}

      {data?.ok ? <>
        {data.teams.length > 1 ? <section className="export-card export-teams-summary"><h2>Equipes no escopo</h2><div>{data.teams.map((team) => <TeamTag key={team.id} name={team.name} count={team.count} />)}</div></section> : null}

        <section className="export-card export-stage-card">
          <header><h2>Distribuição por etapa · {department === "__all__" ? "equipe completa" : department}</h2>{query.isFetching ? <span><RefreshCw className="is-spinning" size={12} aria-hidden="true" />Atualizando gráfico…</span> : null}</header>
          <p className="export-stage-legend">Etapas do funil espelham a situação atual no Bitrix. Perdidos e prazos seguem o período selecionado.</p>
          <TeamStageChart criticalById={aggregates.critical} stages={stages.filter((stage) => !isLostStageName(stage.name)).map((stage) => ({ id: stage.id, name: stage.name, count: aggregates.totals[stage.id] ?? 0, color: stage.color }))} />
          <div className="export-lost-list">{stages.filter((stage) => isLostStageName(stage.name)).map((stage) => <LostStageTag key={stage.id} name={stage.name} count={aggregates.totals[stage.id] ?? 0} />)}</div>
        </section>

        {priorityRows.length ? (
          <section className="export-priority-section">
            <header><AlertTriangle size={17} aria-hidden="true" /><h2>Prioridade · leads críticos</h2><span>({priorityRows.length})</span></header>
            <div>{priorityRows.map((row) => (
              <BrokerCard
                row={row}
                exempt={false}
                key={row.user.ID}
                onOpenCritical={() => openBrokerLeads(row, "critical")}
                onOpenQuarantine={() => openBrokerLeads(row, "quarantine")}
              />
            ))}</div>
          </section>
        ) : null}

        {bitrixFilter !== "inativo" ? (
          <section className="export-active-section">
            <header><UserCheck size={17} aria-hidden="true" /><h2>Ativos no Bitrix</h2><span>({activeBrokerRows.length})</span></header>
            <BrokerTeamGroups
              groups={activeGroups}
              exempt={false}
              onOpenCritical={(row) => openBrokerLeads(row, "critical")}
              onOpenQuarantine={(row) => openBrokerLeads(row, "quarantine")}
            />
            {!activeBrokerRows.length ? (
              <div className="export-card empty-state export-empty">
                <UserCheck size={28} aria-hidden="true" />
                <h3>Nenhum corretor ativo</h3>
                <p>Nenhum resultado ativo no Bitrix para os filtros atuais.</p>
                <div className="export-empty-actions">
                  {filtersActive ? <button className="button button-secondary" type="button" onClick={resetFilters}>Limpar filtros</button> : null}
                  <button className="button button-secondary" type="button" onClick={refreshTeam} disabled={query.isFetching}>Atualizar sincronização</button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {bitrixFilter !== "ativo" && inactiveBrokerRows.length ? (
          <section className="export-inactive-section">
            <header><UserX size={17} aria-hidden="true" /><h2>Inativos no Bitrix</h2><span>({inactiveBrokerRows.length})</span></header>
            <BrokerTeamGroups
              groups={inactiveGroups}
              exempt={false}
              onOpenCritical={(row) => openBrokerLeads(row, "critical")}
              onOpenQuarantine={(row) => openBrokerLeads(row, "quarantine")}
            />
          </section>
        ) : null}

        {bitrixFilter === "inativo" && !inactiveBrokerRows.length ? (
          <section className="export-inactive-section">
            <header><UserX size={17} aria-hidden="true" /><h2>Inativos no Bitrix</h2><span>(0)</span></header>
            <div className="export-card empty-state export-empty">
              <UserX size={28} aria-hidden="true" />
              <h3>Nenhum corretor inativo</h3>
              <p>Nenhum resultado inativo no Bitrix para os filtros atuais.</p>
              <div className="export-empty-actions">
                {filtersActive ? <button className="button button-secondary" type="button" onClick={resetFilters}>Limpar filtros</button> : null}
                <button className="button button-secondary" type="button" onClick={refreshTeam} disabled={query.isFetching}>Atualizar sincronização</button>
              </div>
            </div>
          </section>
        ) : null}

        {exemptRows.length ? (
          <section className="export-exempt-section">
            <header><Ban size={17} aria-hidden="true" /><h2>Corretores dispensados da ferramenta</h2><span>({exemptRows.length})</span></header>
            <div>{exemptRows.map((row) => (
              <BrokerCard
                row={row}
                exempt
                key={row.user.ID}
                onOpenCritical={() => openBrokerLeads(row, "critical")}
                onOpenQuarantine={() => openBrokerLeads(row, "quarantine")}
              />
            ))}</div>
          </section>
        ) : null}

        {!rows.length ? (
          <section className="export-card empty-state export-empty">
            <Users size={28} aria-hidden="true" />
            <h3>Nenhum colaborador no escopo</h3>
            <p>O departamento vinculado ao seu usuário Bitrix não retornou colaboradores. Verifique o vínculo de e-mail ou atualize a sincronização.</p>
            <div className="export-empty-actions">
              <button className="button button-secondary" type="button" onClick={refreshTeam} disabled={query.isFetching}>Atualizar sincronização</button>
            </div>
          </section>
        ) : null}

        <p className="export-updated">Última atualização: {new Date(data.updatedAt).toLocaleString("pt-BR")}</p>
      </> : null}

      <ExpiringLeadsDialog
        broker={leadsDialog ? { id: leadsDialog.id, name: leadsDialog.name } : null}
        mode={leadsDialog?.mode ?? "critical"}
        onClose={closeDialog}
      />
    </div>
  );
}
