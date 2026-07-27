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
import { useState } from "react";
import { moveComercialKanbanCard, transferComercialKanbanCards } from "@/lib/actions/comercial-kanban";
import type { ComercialKanbanCard, ComercialKanbanStage } from "@/lib/types/comercial-kanban";

type DragData = { card: ComercialKanbanCard; stageId: string };
type DropData = { stageId: string };
type BrokerOption = { id: string; name: string; team: string };

const stageColors = ["#3C1A4F", "#62584D", "oklch(0.67 0.14 75)", "#A98DB2", "#1C1C1C"];

function stageColor(stage: ComercialKanbanStage, index: number) {
  if (stage.semantics === "S") return "oklch(0.55 0.13 155)";
  if (stage.semantics === "F") return "oklch(0.56 0.19 28)";
  return stageColors[index % stageColors.length];
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
      className={`kanban-card${overlay ? " is-overlay" : ""}${isDragging ? " is-dragging" : ""}${selected ? " is-selected" : ""}`}
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined, "--stage-color": color } as React.CSSProperties}
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
          <button type="button" className="kanban-drag-handle" aria-label={`Mover ${card.title}`} {...listeners} {...attributes}>
            <GripVertical size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="kanban-card-assignee"><UserRound size={13} aria-hidden="true" />{card.assignedTo}</p>
      <p className="kanban-card-team">{card.team}</p>
      <div className="kanban-card-meta">
        <span><CalendarDays size={12} aria-hidden="true" />{formatDate(card.enteredAt)}</span>
        {staleDays >= 3 ? <span className="kanban-stale"><Clock3 size={12} aria-hidden="true" />{staleDays} dias sem mover</span> : null}
      </div>
      <span className="kanban-roleta" title={card.roulette}>{card.roulette}</span>
    </article>
  );
}

function KanbanColumn({
  stage,
  index,
  canMove,
  batchMode,
  selectedIds,
  onOpen,
  onToggle,
}: {
  stage: ComercialKanbanStage;
  index: number;
  canMove: boolean;
  batchMode: boolean;
  selectedIds: Set<string>;
  onOpen: (card: ComercialKanbanCard) => void;
  onToggle: (card: ComercialKanbanCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage.id}`, data: { stageId: stage.id } satisfies DropData });
  const color = stageColor(stage, index);

  return (
    <section ref={setNodeRef} className={`kanban-column${isOver ? " is-over" : ""}`} style={{ "--stage-color": color } as React.CSSProperties}>
      <header className="kanban-column-header">
        <span className="kanban-column-signal" aria-hidden="true" />
        <div>
          <h2>{stage.name}</h2>
          <p>{stage.cards.length === 1 ? "1 negócio" : `${stage.cards.length} negócios`}</p>
        </div>
        <strong>{stage.cards.length}</strong>
      </header>
      <div className="kanban-column-body">
        {stage.cards.length ? stage.cards.map((card) => (
          <DealCard
            key={card.id}
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
  brokers,
  transferring,
  onClose,
  onTransfer,
}: {
  card: ComercialKanbanCard;
  stage: ComercialKanbanStage;
  brokers: BrokerOption[];
  transferring: boolean;
  onClose: () => void;
  onTransfer: (brokerId: string) => void;
}) {
  const [targetBrokerId, setTargetBrokerId] = useState("");
  const fields = [
    { icon: UserRound, label: "Corretor", value: card.assignedTo },
    { icon: UsersRound, label: "Equipe", value: card.team },
    { icon: CircleDollarSign, label: "Valor", value: formatCurrency(card.value) },
    { icon: CalendarDays, label: "Entrada", value: formatDate(card.enteredAt) },
    { icon: Clock3, label: "Última movimentação", value: formatDate(card.updatedAt) },
  ];

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
          {brokers.length ? (
            <div className="kanban-transfer-block">
              <label htmlFor="drawer-target-broker">Transferir negócio</label>
              <div>
                <select
                  id="drawer-target-broker"
                  value={targetBrokerId}
                  onChange={(event) => setTargetBrokerId(event.target.value)}
                  disabled={transferring}
                >
                  <option value="">Selecione o corretor</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.id}>{broker.name} · {broker.team}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!targetBrokerId || transferring}
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
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));

  const selected = (() => {
    for (const stage of stages) {
      const card = stage.cards.find((item) => item.id === selectedId);
      if (card) return { card, stage };
    }
    return null;
  })();

  async function handleDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;
    setActiveDrag(null);
    if (!active || !over || active.stageId === over.stageId || moving) return;

    const previous = stages;
    setError("");
    setStages((current) => moveCard(current, active.card.id, over.stageId));
    setMoving(true);
    const result = await moveComercialKanbanCard({ opportunityId: active.card.id, stageId: over.stageId });
    setMoving(false);
    if (!result.ok) {
      setStages(previous);
      setError(result.error);
    }
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

  async function handleTransfer(cardIds: string[], brokerId: string, closeDrawer = false) {
    if (!cardIds.length || !brokerId || transferring) return;
    const broker = brokers.find((item) => item.id === brokerId);
    if (!broker) return;

    setError("");
    setTransferring(true);
    const result = await transferComercialKanbanCards({ opportunityIds: cardIds, brokerId });
    setTransferring(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const movedIds = new Set(result.movedIds);
    setStages((current) => assignCards(current, movedIds, broker));
    setSelectedIds((current) => new Set([...current].filter((id) => !movedIds.has(id))));
    if (result.warning) setError(result.warning);
    if (closeDrawer && movedIds.has(cardIds[0])) setSelectedId(null);
    if (!result.warning && !closeDrawer) {
      setBatchMode(false);
      setTargetBrokerId("");
    }
  }

  return (
    <div className="kanban-workspace">
      {error ? (
        <div className="kanban-error" role="alert">
          <span>{error}</span>
          <button type="button" className="button button-quiet" onClick={() => setError("")}><RotateCcw size={15} />Fechar</button>
        </div>
      ) : null}
      {canMove && brokers.length ? (
        <div className={`kanban-batch-toolbar${batchMode ? " is-active" : ""}`}>
          <button type="button" className="button button-secondary" aria-pressed={batchMode} onClick={toggleBatchMode} disabled={transferring}>
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
                onClick={() => handleTransfer([...selectedIds], targetBrokerId)}
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
          {stages.map((stage, index) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              index={index}
              canMove={canMove && !moving && !transferring}
              batchMode={batchMode}
              selectedIds={selectedIds}
              onOpen={(card) => setSelectedId(card.id)}
              onToggle={toggleCard}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDrag ? (
            <DealCard
              card={activeDrag.card}
              stageId={activeDrag.stageId}
              color={stageColor(stages.find((stage) => stage.id === activeDrag.stageId)!, Math.max(0, stages.findIndex((stage) => stage.id === activeDrag.stageId)))}
              canMove={false}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {moving ? <div className="kanban-moving" aria-live="polite"><Loader2 className="spin" size={17} />Atualizando fase no Bitrix24…</div> : null}
      {selected ? (
        <DealDrawer
          card={selected.card}
          stage={selected.stage}
          brokers={brokers}
          transferring={transferring}
          onClose={() => setSelectedId(null)}
          onTransfer={(brokerId) => handleTransfer([selected.card.id], brokerId, true)}
        />
      ) : null}
    </div>
  );
}
