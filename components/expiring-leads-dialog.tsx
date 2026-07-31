"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, MessageSquareOff, PauseCircle, Timer, X, Zap } from "lucide-react";
import { loadExpiringLeads } from "@/lib/actions/equipe";
import type { ExpiringLead, ExpiringLeadsMode } from "@/lib/types/equipe";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function formatCountdown(ms: number) {
  const absolute = Math.abs(ms);
  const days = Math.floor(absolute / 86_400_000);
  const hours = Math.floor((absolute % 86_400_000) / 3_600_000);
  const minutes = Math.floor((absolute % 3_600_000) / 60_000);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  const seconds = Math.floor((absolute % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

function deadlineLabel(lead: ExpiringLead) {
  if (lead.deadlineSource === "quarentena") return "Prazo da quarentena";
  return "Prazo";
}

function LeadRow({ lead, mode, tick, tickMs }: { lead: ExpiringLead; mode: ExpiringLeadsMode; tick: number; tickMs: number }) {
  const remaining = lead.msRemaining - tick * tickMs;
  const expired = Boolean(lead.deadline && remaining < 0);
  const quarantine = mode === "quarantine";
  return (
    <article className={`export-lead-row${expired ? " is-expired" : lead.deadline ? " is-due" : " is-stagnant"}`}>
      <div>
        <strong>{lead.title}</strong>
        <p>
          {lead.stageName}
          {lead.deadline ? ` · ${deadlineLabel(lead)}: ${new Date(lead.deadline).toLocaleString("pt-BR")}` : ""}
        </p>
      </div>
      <div className="export-lead-state" aria-live="off">
        {lead.deadline ? (
          <strong>
            <Timer size={14} aria-hidden="true" />
            {expired ? "Expirado há" : "Faltam"} {formatCountdown(remaining)}
          </strong>
        ) : (
          <strong>
            <MessageSquareOff size={14} aria-hidden="true" />
            {quarantine ? "Sem prazo da quarentena" : `${lead.daysStagnated}d sem movimentação`}
          </strong>
        )}
        <div>
          {lead.isQuarantine ? <span><PauseCircle size={11} aria-hidden="true" />Quarentena</span> : null}
          {lead.isRecentlyCreated ? <span>Recém-criado · 7d</span> : null}
          {!quarantine && lead.reason !== "prazo" ? <span>{lead.daysStagnated}d sem mov.</span> : null}
          {lead.isDueRdStation ? <span><Zap size={11} aria-hidden="true" />DUE · RD Station</span> : null}
        </div>
      </div>
      {lead.justification ? <blockquote>“{lead.justification}”</blockquote> : null}
    </article>
  );
}

export function ExpiringLeadsDialog({
  broker,
  mode,
  onClose,
}: {
  broker: { id: string; name: string } | null;
  mode: ExpiringLeadsMode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const quarantine = mode === "quarantine";
  const query = useQuery({
    queryKey: ["expiring-leads", broker?.id, mode],
    queryFn: () => loadExpiringLeads(broker?.id ?? "", mode, true),
    enabled: Boolean(broker),
    staleTime: 0,
  });

  useEffect(() => {
    if (!broker) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLButtonElement>("[data-close]")?.focus();

    function focusables() {
      return [...(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [broker, onClose]);

  useEffect(() => {
    setTick(0);
    setAnnouncement("");
  }, [broker?.id, mode]);

  const items = query.data?.items ?? [];
  const hasDeadlines = items.some((item) => item.deadline);
  const [reducedMotion, setReducedMotion] = useState(false);
  const tickMs = reducedMotion || !hasDeadlines ? 60_000 : 1_000;

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!broker || !hasDeadlines) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), tickMs);
    return () => window.clearInterval(interval);
  }, [broker, hasDeadlines, tickMs]);

  useEffect(() => {
    if (!broker || !query.data?.ok) return;
    if (!items.length) {
      setAnnouncement(
        quarantine
          ? `${broker.name} não tem leads em quarentena no momento.`
          : `${broker.name} está em dia. Nenhum lead crítico.`,
      );
      return;
    }
    setAnnouncement(
      quarantine
        ? `${items.length} ${items.length === 1 ? "lead em quarentena" : "leads em quarentena"} para ${broker.name}.`
        : `${items.length} ${items.length === 1 ? "lead precisa" : "leads precisam"} de atenção para ${broker.name}.`,
    );
  }, [broker, items.length, query.data, quarantine]);

  const expiredCount = items.filter((item) => item.deadline && item.msRemaining < 0).length;
  const dueCount = items.filter((item) => item.deadline && item.msRemaining >= 0).length;
  const stagnantCount = items.filter((item) => !item.deadline).length;
  const groups = useMemo(() => (
    quarantine
      ? [
          { name: "Prazo da quarentena vencido", icon: AlertCircle, tone: "expired", items: items.filter((item) => item.deadline && item.msRemaining < 0) },
          { name: "Prazo da quarentena ativo", icon: AlertTriangle, tone: "due", items: items.filter((item) => item.deadline && item.msRemaining >= 0) },
          { name: "Sem prazo da quarentena", icon: MessageSquareOff, tone: "stagnant", items: items.filter((item) => !item.deadline) },
        ]
      : [
          { name: "Já expirados", icon: AlertCircle, tone: "expired", items: items.filter((item) => item.deadline && item.msRemaining < 0) },
          { name: "Vencem nos próximos 7 dias", icon: AlertTriangle, tone: "due", items: items.filter((item) => item.deadline && item.msRemaining >= 0) },
          { name: "Sem movimentação há 3+ dias", icon: MessageSquareOff, tone: "stagnant", items: items.filter((item) => !item.deadline) },
        ]
  ), [items, quarantine]);

  if (!broker) return null;

  return (
    <div className="export-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <span className="sr-only" aria-live="polite">{announcement}</span>
      <div ref={dialogRef} className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <header>
          <div>
            <h2 id="export-dialog-title">
              {quarantine ? "Leads em Quarentena" : "Leads Críticos"} · {broker.name}
            </h2>
            <p>
              {quarantine
                ? "Negócios com status EM QUARENTENA no Bitrix24. O prazo exibido vem do campo Prazo da quarentena."
                : "Prazo Padrão em até 7 dias (EM ANDAMENTO), ou mais de 2 dias sem movimentação. Sem Roleta Atual não entra."}
            </p>
            {query.data?.ok && items.length ? (
              <p className="export-dialog-summary">
                {quarantine ? (
                  <>
                    {items.length} em quarentena
                    {expiredCount ? ` · ${expiredCount} com prazo vencido` : ""}
                    {dueCount ? ` · ${dueCount} com prazo ativo` : ""}
                    {stagnantCount ? ` · ${stagnantCount} sem prazo definido` : ""}
                  </>
                ) : (
                  <>
                    {items.length} {items.length === 1 ? "lead precisa" : "leads precisam"} de atenção
                    {expiredCount ? ` · ${expiredCount} expirado${expiredCount === 1 ? "" : "s"}` : ""}
                    {dueCount ? ` · ${dueCount} no prazo` : ""}
                    {stagnantCount ? ` · ${stagnantCount} parado${stagnantCount === 1 ? "" : "s"}` : ""}
                  </>
                )}
              </p>
            ) : null}
          </div>
          <button className="icon-button" data-close type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>
        <div className="export-dialog-content">
          {query.isLoading ? <p className="export-dialog-message">Carregando…</p> : null}
          {query.data && !query.data.ok ? <p className="export-dialog-error">{query.data.error}</p> : null}
          {query.data?.ok && !items.length ? (
            <div className="empty-state export-dialog-empty">
              <CheckCircle2 size={28} aria-hidden="true" />
              <h3>{quarantine ? "Nenhum lead em quarentena" : "Nenhum lead crítico"}</h3>
              <p>
                {quarantine
                  ? "Este corretor não tem negócios com status EM QUARENTENA no momento."
                  : "Este corretor está em dia no momento."}
              </p>
              <div className="export-empty-actions">
                <button className="button button-secondary" type="button" onClick={onClose}>Fechar painel</button>
              </div>
            </div>
          ) : null}
          {groups.map((group) => group.items.length ? (
            <section className={`export-lead-group is-${group.tone}`} key={group.name}>
              <h3><group.icon size={14} aria-hidden="true" />{group.name} ({group.items.length})</h3>
              <div>{group.items.map((lead) => <LeadRow lead={lead} mode={mode} tick={tick} tickMs={tickMs} key={lead.dealId} />)}</div>
            </section>
          ) : null)}
        </div>
      </div>
    </div>
  );
}
