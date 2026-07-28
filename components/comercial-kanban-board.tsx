"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  CircleDollarSign,
  Clock3,
  GripVertical,
  Loader2,
  RotateCcw,
  Square,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { moveComercialKanbanCard, transferComercialKanbanCards } from "@/lib/actions/comercial-kanban";
import type { ComercialKanbanCard, ComercialKanbanStage } from "@/lib/types/comercial-kanban";

type DragData = { card: ComercialKanbanCard; stageId: string };
type DropData = { stageId: string };
type BrokerOption = { id: string; name: string; team: string };

type Flash =
  | { kind: "success"; message: string; undo?: () => void | Promise<void> }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

type PendingConfirm =
  | {
      kind: "move";
      card: ComercialKanbanCard;
      fromStageId: string;
      toStageId: string;
      toStageName: string;
      semantics: "S" | "F";
    }
  | {
      kind: "transfer";
      cardIds: string[];
      brokerId: string;
      brokerName: string;
      closeDrawer: boolean;
    };

const UNDO_MS = 8_000;

function stageAccent(stage: ComercialKanbanStage) {
  if (stage.semantics === "S") return "oklch(0.55 0.13 155)";
  if (stage.semantics === "F") return "oklch(0.56 0.19 28)";
  return "var(--line)";
}

function stageToneClass(stage: ComercialKanbanStage) {
  if (stage.semantics === "S") return " is-won";
  if (stage.semantics === "F") return " is-lost";
  return " is-pipeline";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function daysSince(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

function moveCard(stages: ComercialKanbanStage[], cardId: string, targetStageId: string) {
  let moved: ComercialKanbanCard | null = null;
  const withoutCard = stages.map((stage) => ({
    ...stage,
    cards: stage.cards.filter((card) => {
      if (card.id !== cardId) return true;
      moved = { ...card, stageId: targetStageId };
      return false;
    }),
  }));
  if (!moved) return stages;
  return withoutCard.map((stage) => (
    stage.id === targetStageId ? { ...stage, cards: [moved!, ...stage.cards] } : stage
  ));
}

function assignCards(
  stages: ComercialKanbanStage[],
  cardIds: Set<string>,
  broker: BrokerOption,
) {
  return stages.map((stage) => ({
    ...stage,
    cards: stage.cards.map((card) => (
      cardIds.has(card.id) ? { ...card, assignedTo: broker.name, team: broker.team } : card
    )),
  }));
}

function DealCard({
  card,
  stageId,
  color,
  canMove,
  batchMode = false,
  selected = false,
  overlay = false,
  onOpen,
  onToggle,
}: {
  card: ComercialKanbanCard;
  stageId: string;
  color: string;
  canMove: boolean;
  batchMode?: boolean;
  selected?: boolean;
  overlay?: boolean;
  onOpen?: (card: ComercialKanbanCard) => void;
  onToggle?: (card: ComercialKanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card, stageId } satisfies DragData,
    disabled: !canMove || batchMode || overlay,
  });
  const staleDays = daysSince(card.updatedAt);

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      data-card-id={overlay ? undefined : card.id}
      className={`kanban-card${overlay ? " is-overlay" : ""}${isDragging ? " is-dragging" : ""}${selected ? " is-selected" : ""}`}
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined, "--stage-color": color } as CSSProperties}
    >
      <div className="kanban-card-topline" />
      <div className="kanban-card-head">
        <button type="button" className="kanban-card-title" onClick={() => batchMode ? onToggle?.(card) : onOpen?.(card)}>
          {card.title}
        </button>
        {batchMode && !overlay ? (
          <button
            type="button"
            className="kanban-drag-handle"
            aria-label={selected ? `Remover ${card.title} da seleção` : `Selecionar ${card.title}`}
            aria-pressed={selected}
            onClick={() => onToggle?.(card)}
          >
            {selected ? <CheckSquare size={18} aria-hidden="true" /> : <Square size={18} aria-hidden="true" />}
          </button>
        ) : canMove && !overlay ? (
          <button
            type="button"
            className="kanban-drag-handle"
            aria-label={`Mover ${card.title}. Arraste para outra coluna ou abra o card para escolher a fase.`}
            {...listeners}
            {...attributes}
          >
            <GripVertical size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="kanban-card-assignee"><UserRound size={13} aria-hidden="true" />{card.assignedTo}</p>
      <p className="kanban-card-team">{card.team}</p>
      <div className="kanban-card-meta">
        <span><CircleDollarSign size={12} aria-hidden="true" />{formatCurrency(card.value)}</span>
        <span><CalendarDays size={12} aria-hidden="true" />{formatDate(card.enteredAt)}</span>
        {staleDays >= 3 ? <span className="kanban-stale"><Clock3 size={12} aria-hidden="true" />{staleDays} dias sem mover</span> : null}
      </div>
      <span className="kanban-roleta" title={card.roulette}>{card.roulette}</span>
    </article>
  );
}

function KanbanColumn({
  stage,
  canMove,
  batchMode,
  selectedIds,
  onOpen,
  onToggle,
}: {
  stage: ComercialKanbanStage;
  canMove: boolean;
  batchMode: boolean;
  selectedIds: Set<string>;
  onOpen: (card: ComercialKanbanCard) => void;
  onToggle: (card: ComercialKanbanCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}`, data: { stageId: stage.id } satisfies DropData });
  const color = stageAccent(stage);
  const semanticLabel = stage.semantics === "S" ? "Ganho" : stage.semantics === "F" ? "Perdido" : null;

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${stageToneClass(stage)}${isOver ? " is-over" : ""}`}
      style={{ "--stage-color": color } as CSSProperties}
    >
      <header className="kanban-column-header">
        <span className="kanban-column-signal" aria-hidden="true" />
        <div>
          <h2>{stage.name}</h2>
          {semanticLabel ? (
            <p><span className={`status ${stage.semantics === "S" ? "status-success" : "status-danger"}`}>{semanticLabel}</span></p>
          ) : null}
        </div>
        <strong aria-label={stage.cards.length === 1 ? "1 negócio" : `${stage.cards.length} negócios`}>
          {stage.cards.length}
        </strong>
      </header>
      <div className="kanban-column-body">
        {stage.cards.length ? stage.cards.map((card) => (
          <DealCard
            key={`${stage.id}:${card.id}`}
            card={card}
            stageId={stage.id}
            color={color}
            canMove={canMove}
            batchMode={batchMode}
            selected={selectedIds.has(card.id)}
            onOpen={onOpen}
            onToggle={onToggle}
          />
        )) : (
          <p className="kanban-column-empty">Nenhum negócio nesta fase.</p>
        )}
      </div>
    </section>
  );
}

function DealDrawer({
  card,
  stage,
  stages,
  brokers,
  canMove,
  transferring,
  moving,
  onClose,
  onTransfer,
  onMove,
}: {
  card: ComercialKanbanCard;
  stage: ComercialKanbanStage;
  stages: ComercialKanbanStage[];
  brokers: BrokerOption[];
  canMove: boolean;
  transferring: boolean;
  moving: boolean;
  onClose: () => void;
  onTransfer: (brokerId: string) => void;
  onMove: (stageId: string) => void;
}) {
  const [targetBrokerId, setTargetBrokerId] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const fields = [
    { icon: UserRound, label: "Corretor", value: card.assignedTo },
    { icon: UsersRound, label: "Equipe", value: card.team },
    { icon: CircleDollarSign, label: "Valor", value: formatCurrency(card.value) },
    { icon: CalendarDays, label: "Entrada", value: formatDate(card.enteredAt) },
    { icon: Clock3, label: "Última movimentação", value: formatDate(card.updatedAt) },
  ];
  const moveTargets = stages.filter((item) => item.id !== stage.id);
  const busy = transferring || moving;

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside
        className="kanban-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-detail-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key !== "Tab") return;
          const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("button, a[href], select")];
          const first = focusable[0];
          const last = focusable.at(-1);
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header>
          <div>
            <span className="status status-info">{stage.name}</span>
            <h2 id="kanban-detail-title">{card.title}</h2>
            <p>Negócio #{card.bitrixDealId}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar detalhes" autoFocus><X size={20} /></button>
        </header>
        <div className="kanban-drawer-content">
          <dl>
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <dt><Icon size={14} aria-hidden="true" />{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="kanban-drawer-roleta">
            <span>Roleta atual</span>
            <strong>{card.roulette}</strong>
          </div>
          {canMove && moveTargets.length ? (
            <div className="kanban-transfer-block">
              <label htmlFor="drawer-target-stage">Mover para fase</label>
              <div>
                <select
                  id="drawer-target-stage"
                  value={targetStageId}
                  onChange={(event) => setTargetStageId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Selecione a fase</option>
                  {moveTargets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.semantics === "S" ? " · Ganho" : item.semantics === "F" ? " · Perdido" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!targetStageId || busy}
                  onClick={() => onMove(targetStageId)}
                >
                  {moving ? <Loader2 className="spin" size={16} aria-hidden="true" /> : null}
                  Mover
                </button>
              </div>
            </div>
          ) : null}
          {brokers.length ? (
            <div className="kanban-transfer-block">
              <label htmlFor="drawer-target-broker">Transferir negócio</label>
              <div>
                <select
                  id="drawer-target-broker"
                  value={targetBrokerId}
                  onChange={(event) => setTargetBrokerId(event.target.value)}
                  disabled={busy}
                >
                  <option value="">Selecione o corretor</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>{broker.name} · {broker.team}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!targetBrokerId || busy}
                  onClick={() => onTransfer(targetBrokerId)}
                >
                  {transferring ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <ArrowRightLeft size={16} aria-hidden="true" />}
                  Transferir
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <footer>
          {card.bitrixUrl ? (
            <a className="button button-primary" href={card.bitrixUrl} target="_blank" rel="noreferrer">
              Abrir no Bitrix24 <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="drawer-backdrop kanban-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div
        className="kanban-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kanban-confirm-title"
        aria-describedby="kanban-confirm-body"
      >
        <h2 id="kanban-confirm-title">{title}</h2>
        <p id="kanban-confirm-body">{body}</p>
        <div className="kanban-confirm-actions">
          <button type="button" className="button button-quiet" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            disabled={busy}
            autoFocus
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ComercialKanbanBoard({
  initialStages,
  canMove,
  brokers,
}: {
  initialStages: ComercialKanbanStage[];
  canMove: boolean;
  brokers: BrokerOption[];
}) {
  const [stages, setStages] = useState(initialStages);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [targetBrokerId, setTargetBrokerId] = useState("");
  const [moving, setMoving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusCardId = useRef<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  function dismissDrawer() {
    const restoreId = focusCardId.current ?? selectedId;
    setSelectedId(null);
    if (!restoreId) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-card-id="${restoreId}"] .kanban-card-title`)?.focus();
    });
  }

  function openCard(card: ComercialKanbanCard) {
    focusCardId.current = card.id;
    setSelectedId(card.id);
  }

  const selected = (() => {
    for (const stage of stages) {
      const card = stage.cards.find((item) => item.id === selectedId);
      if (card) return { card, stage };
    }
    return null;
  })();

  function clearFlash() {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setFlash(null);
  }

  function showSuccess(message: string, undo?: () => void | Promise<void>) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setFlash({ kind: "success", message, undo });
    undoTimer.current = setTimeout(() => {
      setFlash((current) => (current?.kind === "success" ? null : current));
      undoTimer.current = null;
    }, UNDO_MS);
  }

  async function commitMove(card: ComercialKanbanCard, fromStageId: string, toStageId: string, toStageName: string) {
    const previous = stages;
    setFlash(null);
    setStages((current) => moveCard(current, card.id, toStageId));
    setMoving(true);
    const result = await moveComercialKanbanCard({ opportunityId: card.id, stageId: toStageId });
    setMoving(false);
    if (!result.ok) {
      setStages(previous);
      setFlash({ kind: "error", message: result.error });
      return;
    }

    showSuccess(`Fase atualizada no Bitrix24: ${toStageName}`, async () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }
      setFlash(null);
      setStages((current) => moveCard(current, card.id, fromStageId));
      setMoving(true);
      const undo = await moveComercialKanbanCard({ opportunityId: card.id, stageId: fromStageId });
      setMoving(false);
      if (!undo.ok) {
        setStages((current) => moveCard(current, card.id, toStageId));
        setFlash({ kind: "error", message: undo.error || "Não foi possível desfazer no Bitrix24." });
        return;
      }
      showSuccess("Movimentação desfeita no Bitrix24.");
    });
  }

  function requestMove(card: ComercialKanbanCard, fromStageId: string, toStageId: string) {
    const target = stages.find((stage) => stage.id === toStageId);
    if (!target) return;
    if (target.semantics === "S" || target.semantics === "F") {
      setPending({
        kind: "move",
        card,
        fromStageId,
        toStageId,
        toStageName: target.name,
        semantics: target.semantics,
      });
      return;
    }
    void commitMove(card, fromStageId, toStageId, target.name);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    setActiveDrag(null);
    if (!active || !over || active.stageId === over.stageId || moving || transferring || pending) return;
    requestMove(active.card, active.stageId, over.stageId);
  }

  function toggleCard(card: ComercialKanbanCard) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  }

  function toggleBatchMode() {
    setBatchMode((current) => !current);
    setSelectedIds(new Set());
    setTargetBrokerId("");
  }

  function requestTransfer(cardIds: string[], brokerId: string, closeDrawer = false) {
    if (!cardIds.length || !brokerId || transferring || moving) return;
    const broker = brokers.find((item) => item.id === brokerId);
    if (!broker) return;
    setPending({
      kind: "transfer",
      cardIds,
      brokerId,
      brokerName: broker.name,
      closeDrawer,
    });
  }

  async function commitTransfer(cardIds: string[], brokerId: string, closeDrawer: boolean) {
    const broker = brokers.find((item) => item.id === brokerId);
    if (!broker) return;

    setFlash(null);
    setTransferring(true);
    const result = await transferComercialKanbanCards({ opportunityIds: cardIds, brokerId });
    setTransferring(false);
    if (!result.ok) {
      setFlash({ kind: "error", message: result.error });
      return;
    }

    const movedIds = new Set(result.movedIds);
    setStages((current) => assignCards(current, movedIds, broker));
    setSelectedIds((current) => new Set([...current].filter((id) => !movedIds.has(id))));
    if (closeDrawer && movedIds.has(cardIds[0])) dismissDrawer();
    if (!result.warning && !closeDrawer) {
      setBatchMode(false);
      setTargetBrokerId("");
    }

    const count = result.movedIds.length;
    const label = count === 1 ? "1 negócio transferido" : `${count} negócios transferidos`;
    if (result.warning) {
      setFlash({ kind: "warning", message: result.warning });
    } else {
      showSuccess(`${label} para ${broker.name}.`);
    }
  }

  async function resolvePending() {
    if (!pending) return;
    const current = pending;
    setPending(null);
    if (current.kind === "move") {
      await commitMove(current.card, current.fromStageId, current.toStageId, current.toStageName);
      return;
    }
    await commitTransfer(current.cardIds, current.brokerId, current.closeDrawer);
  }

  const confirmCopy = pending?.kind === "move"
    ? {
        title: pending.semantics === "S" ? "Marcar como ganho no Bitrix24?" : "Marcar como perdido no Bitrix24?",
        body: `“${pending.card.title}” vai para ${pending.toStageName}. Essa mudança é escrita no Bitrix24.`,
        confirmLabel: pending.semantics === "S" ? "Confirmar ganho" : "Confirmar perdido",
        danger: pending.semantics === "F",
      }
    : pending?.kind === "transfer"
      ? {
          title: pending.cardIds.length === 1 ? "Transferir negócio?" : `Transferir ${pending.cardIds.length} negócios?`,
          body: `A atribuição no Bitrix24 passa para ${pending.brokerName}.`,
          confirmLabel: "Confirmar transferência",
          danger: false,
        }
      : null;

  return (
    <div className="kanban-workspace">
      <div className="sr-only" aria-live="polite">
        {batchMode
          ? `Modo de seleção ativo. ${selectedIds.size === 1 ? "1 negócio selecionado" : `${selectedIds.size} negócios selecionados`}. Toque nos títulos para incluir ou remover.`
          : ""}
      </div>
      {flash ? (
        <div
          className={`kanban-flash is-${flash.kind}`}
          role={flash.kind === "error" || flash.kind === "warning" ? "alert" : "status"}
          aria-live="polite"
        >
          <span>{flash.message}</span>
          <div className="kanban-flash-actions">
            {flash.kind === "success" && flash.undo ? (
              <button type="button" className="button button-quiet" onClick={() => void flash.undo?.()}>
                <RotateCcw size={15} aria-hidden="true" />
                Desfazer
              </button>
            ) : null}
            <button type="button" className="button button-quiet" onClick={clearFlash} aria-label="Dispensar aviso">
              <X size={15} aria-hidden="true" />
              Fechar
            </button>
          </div>
        </div>
      ) : null}
      {canMove && brokers.length ? (
        <div className={`kanban-batch-toolbar${batchMode ? " is-active" : ""}`}>
          <button type="button" className="button button-secondary" aria-pressed={batchMode} onClick={toggleBatchMode} disabled={transferring || moving}>
            <CheckSquare size={16} aria-hidden="true" />
            {batchMode ? "Cancelar seleção" : "Transferir em lote"}
          </button>
          {batchMode ? (
            <>
              <span>{selectedIds.size === 1 ? "1 negócio selecionado" : `${selectedIds.size} negócios selecionados`}</span>
              <select value={targetBrokerId} onChange={(event) => setTargetBrokerId(event.target.value)} disabled={transferring} aria-label="Corretor de destino">
                <option value="">Selecione o corretor</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>{broker.name} · {broker.team}</option>
                ))}
              </select>
              <button
                type="button"
                className="button button-primary"
                disabled={!selectedIds.size || !targetBrokerId || transferring}
                onClick={() => requestTransfer([...selectedIds], targetBrokerId)}
              >
                {transferring ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <ArrowRightLeft size={16} aria-hidden="true" />}
                Transferir
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) => setActiveDrag(event.active.data.current as DragData)}
        onDragCancel={() => setActiveDrag(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board" aria-label="Kanban do Comercial Geral">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              canMove={canMove && !moving && !transferring && !pending}
              batchMode={batchMode}
              selectedIds={selectedIds}
              onOpen={openCard}
              onToggle={toggleCard}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDrag ? (
            <DealCard
              card={activeDrag.card}
              stageId={activeDrag.stageId}
              color={stageAccent(stages.find((stage) => stage.id === activeDrag.stageId)!)}
              canMove={false}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {moving ? <div className="kanban-moving" aria-live="polite"><Loader2 className="spin" size={17} />Atualizando fase no Bitrix24…</div> : null}
      {selected && !pending ? (
        <DealDrawer
          card={selected.card}
          stage={selected.stage}
          stages={stages}
          brokers={brokers}
          canMove={canMove}
          transferring={transferring}
          moving={moving}
          onClose={dismissDrawer}
          onTransfer={(brokerId) => requestTransfer([selected.card.id], brokerId, true)}
          onMove={(stageId) => {
            dismissDrawer();
            requestMove(selected.card, selected.stage.id, stageId);
          }}
        />
      ) : null}
      {pending && confirmCopy ? (
        <ConfirmDialog
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.confirmLabel}
          danger={confirmCopy.danger}
          busy={moving || transferring}
          onCancel={() => setPending(null)}
          onConfirm={() => void resolvePending()}
        />
      ) : null}
    </div>
  );
}
