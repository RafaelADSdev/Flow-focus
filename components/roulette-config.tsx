"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { salvarPermissoesRoletas } from "@/lib/actions/roletas";
import type { RoletasConfigCorretor, RoletasConfigData } from "@/lib/types/roletas";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

function statusBadge(status: RoletasConfigCorretor["status"]) {
  if (status === "bloqueado") return <StatusBadge tone="danger">Bloqueado</StatusBadge>;
  if (status === "auditoria") return <StatusBadge tone="warning">Em auditoria</StatusBadge>;
  return <StatusBadge tone="success">Liberado</StatusBadge>;
}

function snapshotFromData(data: RoletasConfigData): Record<string, string[]> {
  return Object.fromEntries(data.corretores.map((item) => [item.id, [...item.roletas]]));
}

function useCompactLayout() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(max-width: 760px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 760px)").matches,
    () => false,
  );
}

function sortedIds(ids: string[]) {
  return [...ids].sort();
}

function sameRoletas(a: string[] = [], b: string[] = []) {
  const left = sortedIds(a);
  const right = sortedIds(b);
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function isPermissionLocked(status: RoletasConfigCorretor["status"]) {
  return status === "bloqueado";
}

function formatGeradoEm(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function teamLabel(nome: string | null) {
  return nome?.trim() || "Sem equipe";
}

export function RouletteConfig({ data }: { data: RoletasConfigData }) {
  const router = useRouter();
  const compact = useCompactLayout();
  const [query, setQuery] = useState("");
  const [equipeFilter, setEquipeFilter] = useState("");
  const [baseline, setBaseline] = useState(() => snapshotFromData(data));
  const [selected, setSelected] = useState(() => snapshotFromData(data));
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});
  const dataStamp = `${data.gerado_em}:${data.corretores.length}:${data.roletas.length}:${data.corretores
    .map((item) => `${item.id}:${sortedIds(item.roletas).join(",")}:${item.status}`)
    .join("|")}`;

  useEffect(() => {
    const next = snapshotFromData(data);
    setBaseline(next);
    setSelected(next);
    setSaved(false);
    setError("");
    // Sync only when the server snapshot actually changes (encoded in dataStamp).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data is captured when stamp changes
  }, [dataStamp]);

  const equipes = useMemo(
    () =>
      [...new Set(data.corretores.map((item) => item.equipeNome).filter((nome): nome is string => Boolean(nome)))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [data.corretores],
  );

  const semEquipeCount = useMemo(
    () => data.corretores.filter((item) => !item.equipeNome).length,
    [data.corretores],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.corretores
      .filter((item) => {
        if (equipeFilter === "__sem_equipe__" && item.equipeNome) return false;
        if (equipeFilter && equipeFilter !== "__sem_equipe__" && item.equipeNome !== equipeFilter) return false;
        if (!search) return true;
        return [item.nome, item.email, item.equipeNome ?? ""].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const team = teamLabel(a.equipeNome).localeCompare(teamLabel(b.equipeNome), "pt-BR");
        if (team !== 0) return team;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [data.corretores, equipeFilter, query]);

  const filteredGroups = useMemo(() => {
    const groups: { name: string; brokers: RoletasConfigCorretor[] }[] = [];
    for (const broker of filtered) {
      const name = teamLabel(broker.equipeNome);
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.brokers.push(broker);
      else groups.push({ name, brokers: [broker] });
    }
    return groups;
  }, [filtered]);

  const hasActiveFilters = Boolean(query.trim() || equipeFilter);
  const showTeamGroups = !equipeFilter && filteredGroups.length > 1;

  const changeStats = useMemo(() => {
    let cellChanges = 0;
    let brokersChanged = 0;
    const dirtyBrokerIds = new Set<string>();

    for (const broker of data.corretores) {
      const current = selected[broker.id] ?? [];
      const original = baseline[broker.id] ?? [];
      if (sameRoletas(current, original)) continue;

      brokersChanged += 1;
      dirtyBrokerIds.add(broker.id);
      const currentSet = new Set(current);
      const originalSet = new Set(original);
      for (const roleta of data.roletas) {
        if (currentSet.has(roleta.id) !== originalSet.has(roleta.id)) cellChanges += 1;
      }
    }

    return { cellChanges, brokersChanged, dirty: cellChanges > 0, dirtyBrokerIds };
  }, [baseline, data.corretores, data.roletas, selected]);

  const editableFiltered = useMemo(
    () => filtered.filter((broker) => !isPermissionLocked(broker.status)),
    [filtered],
  );

  const permissionColumns = `minmax(240px, 1.65fr) minmax(132px, 0.95fr) repeat(${data.roletas.length}, minmax(140px, 1fr)) minmax(120px, 0.8fr)`;
  const geradoEmLabel = formatGeradoEm(data.gerado_em);
  const patternSource = editableFiltered[0];

  useEffect(() => {
    if (!changeStats.dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changeStats.dirty]);

  useEffect(() => {
    if (!changeStats.dirty) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || saving) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      setSelected(Object.fromEntries(Object.entries(baseline).map(([id, ids]) => [id, [...ids]])));
      setSaved(false);
      setError("");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [baseline, changeStats.dirty, saving]);

  function markDirty() {
    setSaved(false);
    setError("");
  }

  function toggle(corretorId: string, roletaId: string) {
    const broker = data.corretores.find((item) => item.id === corretorId);
    if (!broker || isPermissionLocked(broker.status)) return;

    markDirty();
    setSelected((current) => ({
      ...current,
      [corretorId]: current[corretorId]?.includes(roletaId)
        ? current[corretorId].filter((id) => id !== roletaId)
        : [...(current[corretorId] ?? []), roletaId],
    }));
  }

  function setBrokerRoletas(corretorId: string, roletaIds: string[]) {
    const broker = data.corretores.find((item) => item.id === corretorId);
    if (!broker || isPermissionLocked(broker.status)) return;

    markDirty();
    setSelected((current) => ({
      ...current,
      [corretorId]: [...roletaIds],
    }));
  }

  function toggleColumn(roletaId: string) {
    if (editableFiltered.length === 0) return;

    const allOn = editableFiltered.every((broker) => selected[broker.id]?.includes(roletaId));
    markDirty();
    setSelected((current) => {
      const next = { ...current };
      for (const broker of editableFiltered) {
        const existing = new Set(next[broker.id] ?? []);
        if (allOn) existing.delete(roletaId);
        else existing.add(roletaId);
        next[broker.id] = [...existing];
      }
      return next;
    });
  }

  function applyTeamPattern() {
    if (!patternSource || editableFiltered.length < 2) return;

    const pattern = [...(selected[patternSource.id] ?? [])];
    markDirty();
    setSelected((current) => {
      const next = { ...current };
      for (const broker of editableFiltered) {
        next[broker.id] = [...pattern];
      }
      return next;
    });
  }

  function discardChanges() {
    setSelected(Object.fromEntries(Object.entries(baseline).map(([id, ids]) => [id, [...ids]])));
    setSaved(false);
    setError("");
  }

  function toggleTeamCollapse(teamName: string) {
    setCollapsedTeams((current) => ({
      ...current,
      [teamName]: !current[teamName],
    }));
  }

  function groupDirtyCount(brokers: RoletasConfigCorretor[]) {
    return brokers.reduce((count, broker) => count + (changeStats.dirtyBrokerIds.has(broker.id) ? 1 : 0), 0);
  }

  function saveChanges() {
    if (!changeStats.dirty) return;

    if (!hasSupabaseEnv()) {
      setError("Não foi possível salvar: ambiente sem Supabase. Peça ao administrador para concluir a configuração.");
      return;
    }

    setError("");
    startSaving(async () => {
      const result = await salvarPermissoesRoletas({
        atribuicoes: data.corretores.map((corretor) => ({
          corretorId: corretor.id,
          roletaIds: selected[corretor.id] ?? [],
        })),
      });

      if (!result.ok) {
        setError(result.error || "Não foi possível salvar. Tente de novo em instantes.");
        return;
      }

      setBaseline(Object.fromEntries(Object.entries(selected).map(([id, ids]) => [id, [...ids]])));
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3200);
    });
  }

  const saveLabel = saved
    ? "Alterações salvas"
    : saving
      ? "Salvando…"
      : changeStats.dirty
        ? `Salvar ${changeStats.cellChanges} alteração${changeStats.cellChanges === 1 ? "" : "ões"}`
        : "Salvar alterações";

  function renderToggle(broker: RoletasConfigCorretor, roletaId: string, roletaNome: string) {
    const locked = isPermissionLocked(broker.status);
    const checked = selected[broker.id]?.includes(roletaId) ?? false;

    return (
      <label className={locked ? "is-locked" : undefined} title={locked ? "Bloqueado — permissão não surte efeito até liberar" : undefined}>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked || saving}
          onChange={() => toggle(broker.id, roletaId)}
        />
        <span aria-hidden="true">
          <Check size={14} />
        </span>
        <em className="sr-only">
          {roletaNome} para {broker.nome}
          {locked ? " (bloqueado — sem efeito até liberar)" : ""}
        </em>
      </label>
    );
  }

  function renderBrokerRow(broker: RoletasConfigCorretor) {
    const locked = isPermissionLocked(broker.status);
    const dirty = changeStats.dirtyBrokerIds.has(broker.id);
    return (
      <div
        className={`permission-row${locked ? " is-locked-row" : ""}${dirty ? " is-dirty-row" : ""}`}
        key={broker.id}
      >
        <span className="broker-cell permission-col permission-col-broker">
          <span className="avatar avatar-light">{initials(broker.nome)}</span>
          <span>
            <strong>{broker.nome}</strong>
            <small>{broker.email}</small>
            {!locked && data.roletas.length > 1 ? (
              <span className="permission-row-actions">
                <button
                  type="button"
                  className="permission-row-action"
                  disabled={saving}
                  onClick={() => setBrokerRoletas(broker.id, data.roletas.map((item) => item.id))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="permission-row-action"
                  disabled={saving || !(selected[broker.id]?.length)}
                  onClick={() => setBrokerRoletas(broker.id, [])}
                >
                  Limpar
                </button>
              </span>
            ) : null}
          </span>
        </span>
        <span className="team-cell permission-col permission-col-team">{teamLabel(broker.equipeNome)}</span>
        {data.roletas.map((roulette) => (
          <span key={roulette.id} className="permission-toggle permission-col permission-col-roleta">
            {renderToggle(broker, roulette.id, roulette.nome)}
          </span>
        ))}
        <span className="permission-col permission-col-status">
          {statusBadge(broker.status)}
          {locked ? <small className="permission-lock-note">Sem efeito até liberar</small> : null}
          {broker.status === "auditoria" ? <small className="permission-lock-note">Captura pausada</small> : null}
        </span>
      </div>
    );
  }

  function renderBrokerCard(broker: RoletasConfigCorretor) {
    const locked = isPermissionLocked(broker.status);
    const dirty = changeStats.dirtyBrokerIds.has(broker.id);
    return (
      <article
        className={`permission-card${locked ? " is-locked-row" : ""}${dirty ? " is-dirty-row" : ""}`}
        key={broker.id}
      >
        <header className="permission-card-head">
          <span className="broker-cell">
            <span className="avatar avatar-light">{initials(broker.nome)}</span>
            <span>
              <strong>{broker.nome}</strong>
              <small>{broker.email}</small>
            </span>
          </span>
          <span className="permission-card-meta">
            {statusBadge(broker.status)}
            <span className="team-cell">{teamLabel(broker.equipeNome)}</span>
          </span>
        </header>
        {locked ? (
          <p className="permission-lock-note">Bloqueado — permissões não surtem efeito até liberar a captura.</p>
        ) : null}
        {broker.status === "auditoria" ? (
          <p className="permission-lock-note">Em auditoria — captura pausada; permissões valem após liberar.</p>
        ) : null}
        <ul className="permission-roleta-grid">
          {data.roletas.map((roulette) => {
            const checked = selected[broker.id]?.includes(roulette.id) ?? false;
            return (
              <li
                key={roulette.id}
                className={`permission-roleta-tile${checked ? " is-checked" : ""}${locked ? " is-locked" : ""}`}
              >
                <span className="permission-roleta-tile-copy">
                  <strong>{roulette.nome}</strong>
                  <small>{roulette.disponiveis} oportunidades</small>
                </span>
                <span className="permission-toggle">{renderToggle(broker, roulette.id, roulette.nome)}</span>
              </li>
            );
          })}
        </ul>
        {!locked && data.roletas.length > 1 ? (
          <div className="permission-card-actions">
            <button
              type="button"
              className="button button-quiet"
              disabled={saving}
              onClick={() => setBrokerRoletas(broker.id, data.roletas.map((item) => item.id))}
            >
              Marcar todas
            </button>
            <button
              type="button"
              className="button button-quiet"
              disabled={saving || !(selected[broker.id]?.length)}
              onClick={() => setBrokerRoletas(broker.id, [])}
            >
              Limpar
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar corretor</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" />
        </label>
        <label className="filter-select button button-quiet">
          <Filter size={16} aria-hidden="true" />
          <select
            value={equipeFilter}
            onChange={(event) => setEquipeFilter(event.target.value)}
            aria-label="Filtrar por equipe"
          >
            <option value="">Todas as equipes</option>
            {equipes.map((equipe) => (
              <option key={equipe} value={equipe}>
                {equipe}
              </option>
            ))}
            {semEquipeCount > 0 ? <option value="__sem_equipe__">Sem equipe</option> : null}
          </select>
        </label>
        {equipeFilter && equipeFilter !== "__sem_equipe__" && patternSource && editableFiltered.length > 1 ? (
          <button
            type="button"
            className="button button-quiet"
            disabled={saving}
            onClick={applyTeamPattern}
            title={`Copia as permissões de ${patternSource.nome} para os demais corretores visíveis e liberados.`}
          >
            Replicar de {patternSource.nome.split(" ")[0]}
          </button>
        ) : null}
        <span className="toolbar-spacer" />
        {changeStats.dirty ? (
          <button
            type="button"
            className="button button-secondary"
            disabled={saving}
            onClick={discardChanges}
            title="Descartar alterações (Esc)"
          >
            <X size={16} aria-hidden="true" />
            Descartar
          </button>
        ) : null}
        <button
          type="button"
          className="button button-primary"
          disabled={saving || !data.corretores.length || !changeStats.dirty}
          onClick={saveChanges}
        >
          {saved ? <><Check size={17} aria-hidden="true" />Alterações salvas</> : saveLabel}
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {saved ? (
        <p className="form-success" role="status" aria-live="polite">
          Permissões atualizadas. Quem perdeu uma roleta deixa de vê-la na captura.
        </p>
      ) : null}

      <div className="config-summary">
        <span>
          <SlidersHorizontal size={18} aria-hidden="true" />
          <strong>
            {filtered.length} corretor{filtered.length === 1 ? "" : "es"}
            {hasActiveFilters ? " no filtro" : ""}
          </strong>
          {changeStats.dirty ? (
            <span className="config-dirty-pill">
              {changeStats.cellChanges} mudança{changeStats.cellChanges === 1 ? "" : "s"} · {changeStats.brokersChanged}{" "}
              corretor{changeStats.brokersChanged === 1 ? "" : "es"}
            </span>
          ) : null}
        </span>
        <p>
          {geradoEmLabel ? `Mapa de ${geradoEmLabel}. ` : ""}
          Desmarcar uma roleta remove a fonte da fila do corretor.
          {changeStats.dirty && hasActiveFilters
            ? " Salvar grava o mapa completo — não só o filtro atual."
            : ""}
        </p>
      </div>

      {data.roletas.length === 0 ? (
        <div className="empty-state">
          <SlidersHorizontal size={24} aria-hidden="true" />
          <h2>Nenhuma roleta cadastrada</h2>
          <p>Peça à diretoria ou ao admin para cadastrar as fontes de oportunidade. Depois as permissões aparecem aqui.</p>
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length === 0 ? (
        <div className="empty-state">
          <SlidersHorizontal size={24} aria-hidden="true" />
          <h2>Nenhum corretor sincronizado</h2>
          <p>As roletas já existem, mas ainda não há corretores ativos. Peça ao admin para rodar o sync de pessoas do Bitrix.</p>
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length > 0 && !compact ? (
        <div className="permission-table" style={{ "--permission-columns": permissionColumns } as CSSProperties}>
          <div className="permission-head">
            <span className="permission-col permission-col-broker">Corretor</span>
            <span className="permission-col permission-col-team">Equipe</span>
            {data.roletas.map((roulette) => {
              const editableOn = editableFiltered.filter((broker) => selected[broker.id]?.includes(roulette.id)).length;
              const columnAllOn = editableFiltered.length > 0 && editableOn === editableFiltered.length;
              return (
                <span key={roulette.id} className="permission-col permission-col-roleta">
                  <span className="permission-roleta-name">{roulette.nome}</span>
                  <small>{roulette.disponiveis} oportunidades</small>
                  <button
                    type="button"
                    className="permission-col-action"
                    disabled={saving || editableFiltered.length === 0}
                    onClick={() => toggleColumn(roulette.id)}
                    title={
                      hasActiveFilters
                        ? "Afeta apenas corretores liberados no filtro atual"
                        : "Afeta corretores liberados visíveis"
                    }
                  >
                    {columnAllOn ? "Limpar visíveis" : "Marcar visíveis"}
                  </button>
                </span>
              );
            })}
            <span className="permission-col permission-col-status">Situação</span>
          </div>
          {showTeamGroups
            ? filteredGroups.map((group) => {
                const collapsed = Boolean(collapsedTeams[group.name]);
                const dirtyInGroup = groupDirtyCount(group.brokers);
                return (
                  <div className={`permission-group${collapsed ? " is-collapsed" : ""}`} key={group.name}>
                    <div className="permission-group-label">
                      <button
                        type="button"
                        className="permission-group-toggle"
                        aria-expanded={!collapsed}
                        onClick={() => toggleTeamCollapse(group.name)}
                      >
                        <ChevronDown size={16} aria-hidden="true" className={collapsed ? "is-collapsed" : undefined} />
                        <span>
                          {group.name}
                          <small>
                            {group.brokers.length} corretor{group.brokers.length === 1 ? "" : "es"}
                            {dirtyInGroup > 0
                              ? ` · ${dirtyInGroup} com mudança${dirtyInGroup === 1 ? "" : "s"}`
                              : ""}
                            {collapsed ? " · fechada" : ""}
                          </small>
                        </span>
                      </button>
                    </div>
                    {!collapsed ? group.brokers.map((broker) => renderBrokerRow(broker)) : null}
                  </div>
                );
              })
            : filtered.map((broker) => renderBrokerRow(broker))}
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length > 0 && compact ? (
        <div className="permission-cards">
          {showTeamGroups
            ? filteredGroups.map((group) => {
                const collapsed = Boolean(collapsedTeams[group.name]);
                const dirtyInGroup = groupDirtyCount(group.brokers);
                return (
                  <section className={`permission-card-group${collapsed ? " is-collapsed" : ""}`} key={group.name}>
                    <button
                      type="button"
                      className="permission-group-title"
                      aria-expanded={!collapsed}
                      onClick={() => toggleTeamCollapse(group.name)}
                    >
                      <ChevronDown size={16} aria-hidden="true" className={collapsed ? "is-collapsed" : undefined} />
                      <span>
                        {group.name}
                        <small>
                          {group.brokers.length} corretor{group.brokers.length === 1 ? "" : "es"}
                          {dirtyInGroup > 0
                            ? ` · ${dirtyInGroup} com mudança${dirtyInGroup === 1 ? "" : "s"}`
                            : ""}
                          {collapsed ? " · fechada" : ""}
                        </small>
                      </span>
                    </button>
                    {!collapsed ? group.brokers.map((broker) => renderBrokerCard(broker)) : null}
                  </section>
                );
              })
            : filtered.map((broker) => renderBrokerCard(broker))}
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={24} aria-hidden="true" />
          <h2>Nenhum corretor encontrado</h2>
          <p>
            {query.trim() && equipeFilter
              ? `Nenhum corretor encontrado para "${query}" na equipe selecionada.`
              : query.trim()
                ? "Tente buscar por outro nome ou limpe o campo de pesquisa."
                : "Nenhum corretor nesta equipe."}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setEquipeFilter("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : null}
    </>
  );
}
