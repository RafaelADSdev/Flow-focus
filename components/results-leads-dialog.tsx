"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import type { ResultadoBucket, ResultadoLead } from "@/lib/types/resultados";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

const bucketTone = {
  andamento: "info",
  vendas: "success",
  perdidos: "danger",
  retornaram: "warning",
  quarentena: "warning",
} as const;

function dealUrl(base: string, id: string) {
  return base && id ? `${base}/crm/deal/details/${encodeURIComponent(id)}/` : null;
}

export function ResultsLeadsDialog({
  bucket,
  label,
  leads,
  bitrixPortalBase = "",
  isRefreshing = false,
  onClose,
}: {
  bucket: ResultadoBucket | null;
  label: string;
  leads: ResultadoLead[];
  bitrixPortalBase?: string;
  isRefreshing?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase("pt-BR");
    return leads.filter((lead) => {
      if (bucket !== "total" && lead.bucket !== bucket) return false;
      if (!normalized) return true;
      return [lead.cliente, lead.corretor, lead.etapaAtual, lead.situacao, lead.bitrixDealId]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [bucket, deferredQuery, leads]);

  useEffect(() => {
    if (!bucket) {
      setQuery("");
      return;
    }
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
  }, [bucket, onClose]);

  if (!bucket) return null;

  return (
    <div className="export-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="export-dialog results-dialog" role="dialog" aria-modal="true" aria-labelledby="results-dialog-title">
        <header>
          <div>
            <h2 id="results-dialog-title">{label}</h2>
            <p className="results-dialog-summary">
              {filtered.length} lead{filtered.length === 1 ? "" : "s"} capturado{filtered.length === 1 ? "" : "s"} pelo Flow Focus neste recorte.
            </p>
          </div>
          <button className="icon-button" data-close type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="export-dialog-content results-dialog-content">
          <label className="results-search results-dialog-search">
            <Search size={16} aria-hidden />
            <span className="sr-only">Buscar nos resultados</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cliente, corretor ou etapa"
            />
          </label>

          {filtered.length ? (
            <div className="data-table results-table" role="table" aria-label={`Leads: ${label}`} aria-busy={isRefreshing}>
              <div className="table-head" role="row">
                <span role="columnheader">Cliente</span>
                <span role="columnheader">Corretor</span>
                <span role="columnheader">Captação</span>
                <span role="columnheader">Etapa atual</span>
                <span role="columnheader">Última atualização</span>
                <span role="columnheader">Situação</span>
                <span role="columnheader">Bitrix24</span>
              </div>
              {filtered.map((lead) => {
                const link = dealUrl(bitrixPortalBase, lead.bitrixDealId);
                return (
                  <div className="table-row" role="row" key={lead.id}>
                    <span role="cell" data-label="Cliente"><strong>{lead.cliente}</strong><small>#{lead.bitrixDealId}</small></span>
                    <span role="cell" data-label="Corretor">{lead.corretor}</span>
                    <span role="cell" data-label="Captação">{formatDate(lead.captadaEm)}</span>
                    <span role="cell" data-label="Etapa atual">{lead.etapaAtual}</span>
                    <span role="cell" data-label="Última atualização">{lead.ultimaAtualizacao ? formatDate(lead.ultimaAtualizacao) : "Sem atualização"}</span>
                    <span role="cell" data-label="Situação"><StatusBadge tone={bucketTone[lead.bucket]}>{lead.situacao}</StatusBadge></span>
                    <span role="cell" data-label="Bitrix24">{link ? <a className="table-link" href={link} target="_blank" rel="noreferrer">Abrir<ExternalLink size={13} /></a> : "—"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state export-dialog-empty">
              <Search size={25} aria-hidden />
              <h3>Nenhum lead neste recorte</h3>
              <p>Ajuste a busca ou selecione outro indicador para ampliar a lista.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
