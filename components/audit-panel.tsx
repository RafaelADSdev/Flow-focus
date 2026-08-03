"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { salvarChecklistAuditoriaAction } from "@/lib/actions/auditorias";
import type { AuditoriaFilaItem, AuditoriaLeadItem, AuditoriasPainelData } from "@/lib/types/auditorias";
import { formatUltimaCaptura } from "@/lib/auditorias/format";
import { formatDate, initials } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const checklistItems = [
  { key: "tentativaContato", label: "Tentativa de contato registrada" },
  { key: "comentarioBitrix", label: "Comentário registrado no Bitrix24" },
  { key: "etapaAtualizada", label: "Etapa do negócio atualizada na esteira" },
] as const;

type ChecklistKey = (typeof checklistItems)[number]["key"];
type LeadChecklist = Record<ChecklistKey, boolean>;
type QueueItem = AuditoriaFilaItem & { iniciais: string };

function mapQueue(fila: AuditoriaFilaItem[]): QueueItem[] {
  return fila.map((item) => ({ ...item, iniciais: initials(item.corretor) }));
}

function checklistFromLead(lead: AuditoriaLeadItem): LeadChecklist {
  return {
    tentativaContato: lead.tentativa_contato_ok,
    comentarioBitrix: lead.comentario_bitrix_ok,
    etapaAtualizada: lead.etapa_atualizada_ok,
  };
}

function isApproved(checklist: LeadChecklist | undefined) {
  return Boolean(checklist?.tentativaContato && checklist.comentarioBitrix && checklist.etapaAtualizada);
}

function bitrixUrl(portalBase: string, dealId: string) {
  return portalBase && dealId ? `${portalBase}/crm/deal/details/${encodeURIComponent(dealId)}/` : null;
}

export function AuditPanel({ data, bitrixPortalBase = "" }: { data: AuditoriasPainelData; bitrixPortalBase?: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, LeadChecklist>>({});
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  const queue = useMemo(() => mapQueue(data.fila), [data.fila]);
  const corretoresComPendencias = useMemo(() => queue.filter((item) => item.capturados > 0).length, [queue]);
  const selected = useMemo(() => queue.find((item) => item.id === selectedId), [queue, selectedId]);
  const readyCount = selected?.leads.filter((lead) => isApproved(checked[lead.id])).length ?? 0;

  useEffect(() => {
    if (!selectedId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [selectedId]);

  function toggle(leadId: string, key: ChecklistKey, value: boolean) {
    setChecked((current) => ({
      ...current,
      [leadId]: { ...current[leadId], [key]: value },
    }));
  }

  function openAudit(item: QueueItem) {
    if (!item.leads.length) return;
    setChecked(Object.fromEntries(item.leads.map((lead) => [lead.id, checklistFromLead(lead)])));
    setSelectedId(item.id);
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    setError("");

    const result = await salvarChecklistAuditoriaAction({
      auditoriaId: selected.id,
      observacoes: notes,
      leads: selected.leads.map((lead) => ({
        oportunidadeId: lead.id,
        ...checked[lead.id],
      })),
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const releaseText = result.vagasLiberadas === 1 ? "1 vaga liberada" : `${result.vagasLiberadas} vagas liberadas`;
    const pendingText = result.leadsPendentes === 1 ? "1 lead segue pendente" : `${result.leadsPendentes} leads seguem pendentes`;
    setToast(`${selected.corretor}: ${releaseText}; ${pendingText}.`);
    setSelectedId(null);
    setNotes("");
    router.refresh();
    window.setTimeout(() => setToast(""), 4600);
  }

  return (
    <>
      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} aria-hidden />{toast}
          <button type="button" onClick={() => setToast("")} aria-label="Fechar"><X size={16} /></button>
        </div>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="audit-module" aria-labelledby="audit-queue-heading">
        <div className="audit-overview">
          <div className="section-heading audit-module-heading">
          <div>
            <h2 id="audit-queue-heading">Fila de auditoria</h2>
            <p>
              {queue.length} corretor{queue.length === 1 ? "" : "es"} na fila
              {corretoresComPendencias > 0 ? (
                <> · {corretoresComPendencias} com lead{corretoresComPendencias === 1 ? "" : "s"} aguardando checklist</>
              ) : null}
              . Cada lead aprovado libera uma vaga imediatamente, até o teto de 6 ativos por corretor.
            </p>
          </div>
          <span className="sync-label"><RefreshCw size={14} />Sincronizado {formatDate(data.gerado_em)}</span>
          </div>

          <div className="audit-stats" aria-label="Resumo da auditoria">
          <div><span className="stat-symbol stat-warning"><Clock3 size={19} /></span><span><strong>{data.aguardando}</strong><small>Leads aguardando checklist</small></span></div>
          <div><span className="stat-symbol stat-success"><Check size={19} /></span><span><strong>{data.aprovadas_semana}</strong><small>Leads aprovados na semana</small></span></div>
          <div><span className="stat-symbol stat-danger"><ShieldAlert size={19} /></span><span><strong>{data.bloqueados}</strong><small>Corretores bloqueados</small></span></div>
          </div>

        </div>

        <div className="audit-list-panel">
        {queue.length ? (
          <div className="audit-list">
            {queue.map((item, index) => {
              const emDia = item.capturados === 0;
              return (
              <article className={emDia ? "audit-row audit-row--em-dia" : "audit-row"} key={item.id}>
                <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="avatar avatar-light">{item.iniciais}</span>
                <div className="audit-person">
                  <h3>{item.corretor}</h3>
                  <p>{item.equipe} · Última captura {formatUltimaCaptura(item.ultima_captura)}</p>
                </div>
                <div className={emDia ? "audit-metric metric-muted" : "audit-metric"}>
                  <span>Capacidade</span>
                  <strong>{emDia ? "Sem leads pendentes" : `${item.capturados}/6 ativos`}</strong>
                </div>
                <div className={item.sem_contato ? "audit-metric metric-alert" : emDia ? "audit-metric metric-muted" : "audit-metric"}>
                  <span>Contato</span>
                  <strong>{emDia ? "Checklist em dia" : item.sem_contato ? `${item.sem_contato} pendente${item.sem_contato === 1 ? "" : "s"}` : "Todos registrados"}</strong>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={emDia}
                  onClick={() => openAudit(item)}
                >
                  {emDia ? "Nada a auditar" : "Auditar leads"}
                  {!emDia ? <ArrowRight size={16} /> : null}
                </button>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle2 size={28} />
            <h2>Fila em dia</h2>
            <p>Não há leads ativos aguardando checklist. Novas capturas aparecerão aqui automaticamente.</p>
          </div>
        )}
        </div>
      </section>

      {selected ? (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <aside ref={drawerRef} className="audit-drawer audit-leads-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
            <header>
              <button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Voltar"><ChevronLeft size={20} /></button>
              <div><span>Checklist individual</span><h2 id="audit-drawer-title">{selected.corretor}</h2></div>
              <button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Fechar"><X size={20} /></button>
            </header>
            <div className="drawer-summary">
              <div>
                <span className="avatar avatar-light">{selected.iniciais}</span>
                <span><strong>{selected.capturados} leads ocupando vagas</strong><small>{readyCount} serão aprovados ao salvar</small></span>
              </div>
            </div>
            <div className="drawer-content audit-leads-content">
              <div className="drawer-intro"><h3>Validação por lead</h3><p>Marque os três requisitos. A aprovação é calculada automaticamente.</p></div>
              {selected.leads.map((lead, index) => {
                const leadChecklist = checked[lead.id] ?? checklistFromLead(lead);
                const approved = isApproved(leadChecklist);
                const link = bitrixUrl(bitrixPortalBase, lead.bitrix_deal_id);
                return (
                  <article className="audit-lead" key={lead.id}>
                    <header>
                      <span className="audit-lead-index">{String(index + 1).padStart(2, "0")}</span>
                      <div><h4>{lead.titulo}</h4><p>#{lead.bitrix_deal_id} · {lead.etapa_atual}</p></div>
                      <StatusBadge tone={approved ? "success" : "warning"}>{approved ? "Aprovado" : "Pendente"}</StatusBadge>
                    </header>
                    <div className="audit-lead-meta">
                      <span>Captado {formatDate(lead.captada_em)}</span>
                      {link ? <a href={link} target="_blank" rel="noreferrer">Abrir no Bitrix24<ExternalLink size={13} /></a> : null}
                    </div>
                    <div className="lead-checklist">
                      {checklistItems.map((item) => (
                        <label className="criteria-row criteria-row--compact" key={item.key}>
                          <input type="checkbox" checked={leadChecklist[item.key]} onChange={(event) => toggle(lead.id, item.key, event.target.checked)} />
                          <span className="check-control"><Check size={15} /></span>
                          <span><strong>{item.label}</strong></span>
                        </label>
                      ))}
                    </div>
                  </article>
                );
              })}
              <div className="field">
                <label htmlFor="notes"><MessageSquareText size={16} />Observações da liderança</label>
                <textarea id="notes" value={notes} maxLength={1500} onChange={(event) => setNotes(event.target.value)} placeholder="Registre orientações para os leads que ainda precisam de ajuste." rows={4} />
                <small>{notes.length}/1500 caracteres</small>
              </div>
            </div>
            <footer>
              <p>{readyCount} de {selected.leads.length} leads serão aprovados; os demais continuam ocupando vaga.</p>
              <div><button type="button" className="button button-primary" disabled={pending} onClick={() => void save()}>{pending ? "Salvando…" : `Salvar e liberar ${readyCount} vaga${readyCount === 1 ? "" : "s"}`}</button></div>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
