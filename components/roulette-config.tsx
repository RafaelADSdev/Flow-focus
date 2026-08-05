"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  Filter,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { salvarPermissoesRoletas, sincronizarBolsaoBitrix } from "@/lib/actions/roletas";
import { isRoletaRefreshRequired, summarizeRoletaDraft } from "@/lib/roletas/config-state";
import { sameRoletaIds } from "@/lib/roletas/permissions";
import type { RoletasConfigCorretor, RoletasConfigData, RoletasPermissionReceipt } from "@/lib/types/roletas";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";

function snapshotFromData(data: RoletasConfigData): Record<string, string[]> {
  return Object.fromEntries(data.corretores.map((item) => [item.id, [...item.roletas]]));
}

function isPermissionLocked(status: RoletasConfigCorretor["status"]) {
  return status === "bloqueado";
}

function teamLabel(nome: string | null) {
  return nome?.trim() || "Sem equipe";
}

const roletaTones = ["violet", "teal", "amber", "rose"] as const;

function toneForRoleta(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 997;
  }
  return roletaTones[hash % roletaTones.length];
}

function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLDivElement | null>,
  returnFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogElement = dialog;
    const returnFocusElement = returnFocusRef.current;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      dialogElement.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...dialogElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [dialogRef, onClose, open, returnFocusRef]);
}

function receiptDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function RouletteConfig({ data }: { data: RoletasConfigData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [equipeFilter, setEquipeFilter] = useState("");
  const [baseline, setBaseline] = useState(() => snapshotFromData(data));
  const [selected, setSelected] = useState(() => snapshotFromData(data));
  const [receipt, setReceipt] = useState<RoletasPermissionReceipt | null>(data.ultimo_recibo);
  const [auditWarning, setAuditWarning] = useState("");
  const [saving, startSaving] = useTransition();
  const [syncing, startSyncing] = useTransition();
  const [refreshing, startRefreshing] = useTransition();
  const [syncNotice, setSyncNotice] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});
  const [editingBroker, setEditingBroker] = useState<RoletasConfigCorretor | null>(null);
  const [modalRoletaQuery, setModalRoletaQuery] = useState("");
  const [replicationOpen, setReplicationOpen] = useState(false);
  const [replicationSourceId, setReplicationSourceId] = useState("");
  const [replicationContext, setReplicationContext] = useState<{
    tipo: "replicacao_equipe";
    origemCorretorId: string;
    equipe: string;
    destinos: number;
  } | null>(null);
  const brokerDialogRef = useRef<HTMLDivElement>(null);
  const brokerTriggerRef = useRef<HTMLElement>(null);
  const replicationDialogRef = useRef<HTMLDivElement>(null);
  const replicationTriggerRef = useRef<HTMLElement>(null);
  const closeBrokerModal = useCallback(() => {
    setEditingBroker(null);
    setModalRoletaQuery("");
  }, []);
  const closeReplicationModal = useCallback(() => {
    setReplicationOpen(false);
    setReplicationSourceId("");
  }, []);

  useDialogFocus(Boolean(editingBroker), brokerDialogRef, brokerTriggerRef, closeBrokerModal);
  useDialogFocus(replicationOpen, replicationDialogRef, replicationTriggerRef, closeReplicationModal);

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

  const changeStats = useMemo(
    () => summarizeRoletaDraft({
      brokerIds: data.corretores.map((broker) => broker.id),
      roletaIds: data.roletas.map((roleta) => roleta.id),
      baseline,
      selected,
    }),
    [baseline, data.corretores, data.roletas, selected],
  );
  const refreshRequired = isRoletaRefreshRequired(errorCode);

  const showEquipeFilter = data.viewer_perfil !== "lider";
  const replicationCandidates = useMemo(() => {
    if (!equipeFilter || equipeFilter === "__sem_equipe__") return [];
    return data.corretores
      .filter((broker) => broker.equipeNome === equipeFilter)
      .filter((broker) => !isPermissionLocked(broker.status))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [data.corretores, equipeFilter]);
  const replicationLockedCount = useMemo(
    () => data.corretores.filter((broker) => broker.equipeNome === equipeFilter && isPermissionLocked(broker.status)).length,
    [data.corretores, equipeFilter],
  );
  const replicationSource = replicationCandidates.find((broker) => broker.id === replicationSourceId) ?? null;
  const replicationPreview = useMemo(() => {
    if (!replicationSource) return { targets: [], affected: [], unchanged: [] };
    const pattern = selected[replicationSource.id] ?? [];
    const targets = replicationCandidates.filter((broker) => broker.id !== replicationSource.id);
    return {
      targets,
      affected: targets.filter((broker) => !sameRoletaIds(selected[broker.id] ?? [], pattern)),
      unchanged: targets.filter((broker) => sameRoletaIds(selected[broker.id] ?? [], pattern)),
    };
  }, [replicationCandidates, replicationSource, selected]);
  const roletaNameById = useMemo(
    () => new Map(data.roletas.map((roleta) => [roleta.id, roleta.nome])),
    [data.roletas],
  );

  useEffect(() => {
    if (!changeStats.dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changeStats.dirty]);

  function markDirty() {
    if (!refreshRequired) {
      setError("");
      setErrorCode("");
    }
    setSyncNotice("");
    setAuditWarning("");
  }

  function toggle(corretorId: string, roletaId: string) {
    const broker = data.corretores.find((item) => item.id === corretorId);
    if (!broker || refreshRequired || isPermissionLocked(broker.status)) return;

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
    if (!broker || refreshRequired || isPermissionLocked(broker.status)) return;

    markDirty();
    setSelected((current) => ({
      ...current,
      [corretorId]: [...roletaIds],
    }));
  }

  function openReplicationDialog(trigger: HTMLElement) {
    replicationTriggerRef.current = trigger;
    setReplicationSourceId("");
    setReplicationOpen(true);
  }

  function confirmReplication() {
    if (refreshRequired || !replicationSource || !replicationPreview.affected.length) return;

    const pattern = [...(selected[replicationSource.id] ?? [])];
    markDirty();
    setSelected((current) => {
      const next = { ...current };
      for (const broker of replicationPreview.affected) {
        next[broker.id] = [...pattern];
      }
      return next;
    });
    setReplicationContext({
      tipo: "replicacao_equipe",
      origemCorretorId: replicationSource.id,
      equipe: teamLabel(replicationSource.equipeNome),
      destinos: replicationPreview.affected.length,
    });
    closeReplicationModal();
  }

  function discardChanges() {
    setSelected(Object.fromEntries(Object.entries(baseline).map(([id, ids]) => [id, [...ids]])));
    setError("");
    setErrorCode("");
    setAuditWarning("");
    setReplicationContext(null);
  }

  function requestDiscardChanges() {
    const suffix = changeStats.cellChanges === 1 ? "alteração pendente" : "alterações pendentes";
    if (!window.confirm(`Descartar ${changeStats.cellChanges} ${suffix}? Esta ação não pode ser desfeita.`)) return;
    discardChanges();
  }

  function refreshStaleData() {
    const suffix = changeStats.cellChanges === 1 ? "alteração local" : "alterações locais";
    const confirmed = window.confirm(
      `Atualizar os dados descartará ${changeStats.cellChanges} ${suffix} deste rascunho. Continuar?`,
    );
    if (!confirmed) return;
    startRefreshing(() => router.refresh());
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

  function handleSyncBolsao() {
    if (changeStats.dirty) {
      setError("Salve ou descarte o rascunho antes de sincronizar o bolsão.");
      return;
    }
    setSyncNotice("");
    setError("");
    setErrorCode("");
    startSyncing(async () => {
      const result = await sincronizarBolsaoBitrix();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSyncNotice(
        `${result.importados} lead${result.importados === 1 ? "" : "s"} no bolsão · ${result.roletas} roleta${result.roletas === 1 ? "" : "s"}`,
      );
      router.refresh();
    });
  }

  function saveChanges() {
    if (!changeStats.dirty || refreshRequired) return;

    if (!hasSupabaseEnv()) {
      setError("Não foi possível salvar: ambiente sem Supabase. Peça ao administrador para concluir a configuração.");
      return;
    }

    setError("");
    setErrorCode("");
    setAuditWarning("");
    startSaving(async () => {
      const result = await salvarPermissoesRoletas({
        atribuicoes: data.corretores
          .filter((corretor) => changeStats.dirtyBrokerIds.has(corretor.id))
          .map((corretor) => ({
            corretorId: corretor.id,
            roletaIds: selected[corretor.id] ?? [],
            roletaIdsAntes: baseline[corretor.id] ?? [],
          })),
        contexto: replicationContext ?? undefined,
      });

      if (!result.ok) {
        setError(result.error || "Não foi possível salvar. Tente de novo em instantes.");
        setErrorCode(result.code ?? "");
        return;
      }

      setBaseline(Object.fromEntries(Object.entries(selected).map(([id, ids]) => [id, [...ids]])));
      setReceipt(result.receipt);
      setAuditWarning(result.auditWarning ?? "");
      setReplicationContext(null);
      router.refresh();
    });
  }

  const saveLabel = saving
    ? "Salvando…"
    : `Salvar ${changeStats.cellChanges} alteração${changeStats.cellChanges === 1 ? "" : "ões"}`;

  function renderToggle(broker: RoletasConfigCorretor, roletaId: string, roletaNome: string) {
    const locked = isPermissionLocked(broker.status);
    const checked = selected[broker.id]?.includes(roletaId) ?? false;

    return (
      <label
        className={locked ? "is-locked" : undefined}
        title={locked ? "Bloqueado — permissão não surte efeito até liberar" : undefined}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={locked || saving || refreshRequired}
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

  function renderBrokerRoletaSummary(broker: RoletasConfigCorretor) {
    const ids = selected[broker.id] ?? [];
    const names = ids.map((id) => roletaNameById.get(id)).filter((name): name is string => Boolean(name));
    const count = names.length;
    const visibleNames = names.slice(0, 2);
    const remaining = names.length - visibleNames.length;
    return (
      <span className="permission-roleta-summary">
        <span className="permission-roleta-count">
          <strong>{count}</strong>
          <span>/ {data.roletas.length}</span>
        </span>
        <span className="permission-roleta-summary-names">
          {visibleNames.length ? visibleNames.join(" · ") : "Sem acesso às roletas"}
          {remaining > 0 ? ` +${remaining}` : ""}
        </span>
      </span>
    );
  }

  function renderListHead() {
    return (
      <div className="permission-head" role="row">
        <span className="permission-col-broker" role="columnheader">
          <span className="permission-head-label">Corretor</span>
        </span>
        <span className="permission-col-team" role="columnheader">
          <span className="permission-head-label">Equipe</span>
        </span>
        <span className="permission-col-roletas" role="columnheader">
          <span className="permission-head-label">Acesso às roletas</span>
        </span>
      </div>
    );
  }

  function renderListRow(broker: RoletasConfigCorretor) {
    const locked = isPermissionLocked(broker.status);
    const dirty = changeStats.dirtyBrokerIds.has(broker.id);

    return (
      <div
        className={`permission-row${locked ? " is-locked-row" : ""}${dirty ? " is-dirty-row" : ""}`}
        role="row"
        key={broker.id}
      >
        <span className="permission-col-broker" role="cell">
          <span className="permission-broker-identity">
            <span className="avatar avatar-light" aria-hidden="true">{initials(broker.nome)}</span>
            <span className="permission-broker-copy">
              <strong>{broker.nome}</strong>
              <span className="permission-broker-meta">
                <small>{broker.email}</small>
                {dirty ? <em className="permission-dirty-indicator">Alterado</em> : null}
              </span>
            </span>
          </span>
        </span>
        <span className="permission-col-team team-cell" role="cell" data-label="Equipe">{teamLabel(broker.equipeNome)}</span>
        <span className="permission-col-roletas" role="cell" data-label="Acesso às roletas">
          <button
            type="button"
            className="permission-roleta-open"
            disabled={saving || refreshRequired}
            aria-label={`Editar roletas de ${broker.nome}: ${selected[broker.id]?.length ?? 0} de ${data.roletas.length} liberadas`}
            onClick={(event) => {
              brokerTriggerRef.current = event.currentTarget;
              setEditingBroker(broker);
            }}
          >
            {renderBrokerRoletaSummary(broker)}
            <span className="permission-roleta-edit" aria-hidden="true">
              <Pencil size={14} />
              Editar
            </span>
          </button>
        </span>
      </div>
    );
  }

  function renderBrokerModal() {
    if (!editingBroker) return null;

    const broker = editingBroker;
    const locked = isPermissionLocked(broker.status);
    const selectedCount = selected[broker.id]?.length ?? 0;
    const normalizedQuery = modalRoletaQuery.trim().toLocaleLowerCase("pt-BR");
    const visibleRoletas = normalizedQuery
      ? data.roletas.filter((roleta) => roleta.nome.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
      : data.roletas;

    return (
      <div
        className="export-dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeBrokerModal();
        }}
      >
        <div
          ref={brokerDialogRef}
          className="export-dialog permission-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permission-modal-title"
          aria-describedby="permission-modal-description"
        >
          <header>
            <div>
              <p className="permission-modal-kicker">Roletas do bolsão</p>
              <h2 id="permission-modal-title" tabIndex={-1} data-dialog-initial-focus>{broker.nome}</h2>
              <p>
                {teamLabel(broker.equipeNome)} · {selectedCount} de {data.roletas.length} roleta
                {data.roletas.length === 1 ? "" : "s"} selecionada{selectedCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              className="button button-quiet permission-modal-close"
              onClick={closeBrokerModal}
              aria-label="Fechar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="export-dialog-content permission-modal-content">
            {locked ? (
              <p className="permission-modal-note">
                Corretor bloqueado — as permissões não surtem efeito até a liderança liberar a captura.
              </p>
            ) : null}
            {broker.status === "auditoria" ? (
              <p className="permission-modal-note">Em auditoria — captura pausada; permissões valem após liberar.</p>
            ) : null}
            <p className="permission-modal-intro" id="permission-modal-description">
              Selecione as roletas deste corretor. A seleção ficará pendente até você salvar o lote.
            </p>

            {data.roletas.length > 8 ? (
              <label className="search-box permission-modal-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Buscar roleta</span>
                <input
                  value={modalRoletaQuery}
                  onChange={(event) => setModalRoletaQuery(event.target.value)}
                  placeholder="Buscar roleta"
                />
              </label>
            ) : null}

            <ul className="permission-modal-grid">
              {visibleRoletas.map((roleta) => {
                const checked = selected[broker.id]?.includes(roleta.id) ?? false;
                const tone = toneForRoleta(roleta.id);
                return (
                  <li
                    key={roleta.id}
                    className={`permission-modal-tile${checked ? " is-checked" : ""}${locked ? " is-locked" : ""}`}
                  >
                    <span className={`permission-modal-tile-chip signal-${tone}`}>
                      <span className="permission-modal-tile-name">{roleta.nome}</span>
                    </span>
                    <span className="permission-toggle permission-toggle--cell">
                      {renderToggle(broker, roleta.id, roleta.nome)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {visibleRoletas.length === 0 ? (
              <p className="permission-modal-empty">Nenhuma roleta corresponde à busca.</p>
            ) : null}
          </div>

          <footer className="permission-modal-footer">
            {!locked && data.roletas.length > 1 ? (
              <div className="permission-modal-actions">
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={saving || refreshRequired}
                  onClick={() => setBrokerRoletas(broker.id, [
                    ...new Set([...(selected[broker.id] ?? []), ...visibleRoletas.map((item) => item.id)]),
                  ])}
                >
                  {modalRoletaQuery ? "Marcar visíveis" : "Marcar todas"}
                </button>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={saving || refreshRequired || !selectedCount}
                  onClick={() => setBrokerRoletas(
                    broker.id,
                    (selected[broker.id] ?? []).filter((id) => !visibleRoletas.some((roleta) => roleta.id === id)),
                  )}
                >
                  {modalRoletaQuery ? "Limpar visíveis" : "Limpar"}
                </button>
              </div>
            ) : null}
            <button type="button" className="button button-primary" onClick={closeBrokerModal}>
              Aplicar ao rascunho
            </button>
          </footer>
        </div>
      </div>
    );
  }

  function renderReplicationModal() {
    if (!replicationOpen) return null;
    const sourceRoletaNames = replicationSource
      ? (selected[replicationSource.id] ?? [])
          .map((id) => roletaNameById.get(id))
          .filter((name): name is string => Boolean(name))
      : [];
    const affectedNames = replicationPreview.affected.slice(0, 4).map((broker) => broker.nome);
    const remainingNames = replicationPreview.affected.length - affectedNames.length;

    return (
      <div
        className="export-dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeReplicationModal();
        }}
      >
        <div
          ref={replicationDialogRef}
          className="export-dialog permission-modal permission-replication-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replication-modal-title"
          aria-describedby="replication-modal-description"
        >
          <header>
            <div>
              <p className="permission-modal-kicker">Ação em equipe</p>
              <h2 id="replication-modal-title" tabIndex={-1} data-dialog-initial-focus>
                Replicar permissões
              </h2>
              <p id="replication-modal-description">
                Escolha conscientemente o corretor modelo e revise o alcance antes de aplicar ao rascunho.
              </p>
            </div>
            <button
              type="button"
              className="button button-quiet permission-modal-close"
              onClick={closeReplicationModal}
              aria-label="Fechar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="export-dialog-content permission-modal-content">
            <label className="replication-source-field">
              <span>Usar como modelo</span>
              <select value={replicationSourceId} onChange={(event) => setReplicationSourceId(event.target.value)}>
                <option value="">Selecione um corretor</option>
                {replicationCandidates.map((broker) => (
                  <option value={broker.id} key={broker.id}>{broker.nome}</option>
                ))}
              </select>
            </label>

            {replicationSource ? (
              <div className="replication-preview" aria-live="polite">
                <div className="replication-preview-summary">
                  <strong>
                    Aplicar {sourceRoletaNames.length} roleta{sourceRoletaNames.length === 1 ? "" : "s"} de {replicationSource.nome}
                  </strong>
                  <span>
                    {replicationPreview.affected.length} corretor{replicationPreview.affected.length === 1 ? "" : "es"} com mudança · {replicationPreview.unchanged.length} já igual
                  </span>
                </div>

                <dl className="replication-preview-details">
                  <div>
                    <dt>Roletas do modelo</dt>
                    <dd>{sourceRoletaNames.length ? sourceRoletaNames.join(" · ") : "Nenhuma roleta"}</dd>
                  </div>
                  <div>
                    <dt>Corretores alterados</dt>
                    <dd>
                      {affectedNames.length ? affectedNames.join(", ") : "Nenhum"}
                      {remainingNames > 0 ? ` e mais ${remainingNames}` : ""}
                    </dd>
                  </div>
                  {replicationLockedCount > 0 ? (
                    <div>
                      <dt>Fora do lote</dt>
                      <dd>{replicationLockedCount} bloqueado{replicationLockedCount === 1 ? "" : "s"}; permissões preservadas.</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <p className="permission-modal-note">Nenhuma alteração será aplicada até você escolher o modelo.</p>
            )}
          </div>

          <footer className="permission-modal-footer">
            <button type="button" className="button button-quiet" onClick={closeReplicationModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!replicationSource || !replicationPreview.affected.length}
              onClick={confirmReplication}
            >
              <Copy size={16} aria-hidden="true" />
              Aplicar ao rascunho
            </button>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar roulette-config-toolbar" role="group" aria-label="Filtros e ações da configuração">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Buscar corretor</span>
          <input
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
          />
        </label>
        {showEquipeFilter ? (
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
        ) : null}
        {showEquipeFilter && equipeFilter && equipeFilter !== "__sem_equipe__" && replicationCandidates.length > 1 ? (
          <button
            type="button"
            className="button button-quiet"
            disabled={saving || refreshRequired}
            onClick={(event) => openReplicationDialog(event.currentTarget)}
            title={`Escolha um corretor modelo e revise o alcance na equipe ${equipeFilter}.`}
          >
            <Copy size={16} aria-hidden="true" />
            Replicar permissões
          </button>
        ) : null}
        <span className="toolbar-spacer" />
        {hasSupabaseEnv() ? (
          <button
            type="button"
            className="button button-quiet"
            disabled={syncing || saving || refreshing || changeStats.dirty}
            onClick={handleSyncBolsao}
            title={changeStats.dirty
              ? "Salve ou descarte o rascunho antes de sincronizar."
              : "Atualiza as roletas e os leads do bolsão a partir do Bitrix24."}
          >
            <RefreshCw size={16} className={syncing ? "spin" : undefined} aria-hidden="true" />
            {syncing ? "Sincronizando bolsão…" : "Sincronizar bolsão"}
          </button>
        ) : null}
      </div>

      {error && !refreshRequired ? (
        <div className="form-error config-error" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}
      {syncNotice ? <p className="form-success" role="status" aria-live="polite">{syncNotice}</p> : null}
      {auditWarning ? <p className="form-error" role="alert">{auditWarning}</p> : null}

      {refreshRequired ? (
        <div className="config-change-bar is-blocked" aria-busy={refreshing}>
          <div className="config-change-copy" role="alert" aria-live="assertive">
            <TriangleAlert size={20} aria-hidden="true" />
            <div>
              <strong>Não é seguro continuar neste rascunho</strong>
              <span>{error} Recarregue para conferir o estado atual; este rascunho será descartado.</span>
            </div>
          </div>
          <div className="config-change-actions">
            <button
              type="button"
              className="button button-danger"
              disabled={refreshing}
              onClick={refreshStaleData}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : undefined} aria-hidden="true" />
              {refreshing ? "Atualizando…" : "Atualizar e descartar"}
            </button>
          </div>
        </div>
      ) : changeStats.dirty ? (
        <div className="config-change-bar" aria-busy={saving}>
          <div className="config-change-copy" role="status" aria-live="polite">
            <div>
            <strong>
              {changeStats.cellChanges} mudança{changeStats.cellChanges === 1 ? "" : "s"} em {changeStats.brokersChanged} corretor{changeStats.brokersChanged === 1 ? "" : "es"}
            </strong>
            <span>Rascunho não salvo · sincronização pausada até salvar ou descartar.</span>
            </div>
          </div>
          <div className="config-change-actions">
            <button type="button" className="button button-quiet" disabled={saving} onClick={requestDiscardChanges}>
              Descartar alterações
            </button>
            <button type="button" className="button button-primary" disabled={saving} onClick={saveChanges}>
              {saveLabel}
            </button>
          </div>
        </div>
      ) : receipt ? (
        <div className="config-receipt" role="status">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Última atualização registrada</strong>
            <span>
              {receipt.permissoesAlteradas} mudança{receipt.permissoesAlteradas === 1 ? "" : "s"} em {receipt.corretoresAlterados} corretor{receipt.corretoresAlterados === 1 ? "" : "es"} · {receipt.adicionadas} adicionada{receipt.adicionadas === 1 ? "" : "s"} · {receipt.removidas} removida{receipt.removidas === 1 ? "" : "s"}
            </span>
          </div>
          <small>{receipt.autorNome} · {receiptDateLabel(receipt.registradoEm)}</small>
        </div>
      ) : null}

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
          <p>As roletas já existem, mas ainda não há corretores ativos. Peça ao admin para sincronizar as pessoas do Bitrix24.</p>
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length > 0 ? (
        <div className="permission-matrix-shell">
          <div className="permission-matrix-cap">
            <span className="permission-matrix-cap-title">
              {filtered.length} corretor{filtered.length === 1 ? "" : "es"}
              {hasActiveFilters ? " no filtro" : ""}
            </span>
          </div>
          <div
            className="permission-table permission-list-table permission-matrix"
            role="table"
            aria-label="Permissões por corretor"
          >
            {renderListHead()}
            {showTeamGroups
              ? filteredGroups.map((group) => {
                  const collapsed = Boolean(collapsedTeams[group.name]);
                  const dirtyInGroup = groupDirtyCount(group.brokers);
                  return (
                    <section
                      className={`permission-group${collapsed ? " is-collapsed" : ""}`}
                      role="rowgroup"
                      aria-label={`Equipe ${group.name}`}
                      key={group.name}
                    >
                      <div className="permission-group-label" role="row">
                        <span className="permission-group-header" role="columnheader" aria-colspan={4}>
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
                                {dirtyInGroup > 0 ? ` · ${dirtyInGroup} alterado${dirtyInGroup === 1 ? "" : "s"}` : ""}
                              </small>
                            </span>
                          </button>
                        </span>
                      </div>
                      {!collapsed ? group.brokers.map((broker) => renderListRow(broker)) : null}
                    </section>
                  );
                })
              : filtered.map((broker) => renderListRow(broker))}
          </div>
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

      {renderBrokerModal()}
      {renderReplicationModal()}
    </>
  );
}
