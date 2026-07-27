"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, Clock3, ExternalLink, MessageSquareText, RefreshCw, ShieldAlert, X } from "lucide-react";
import { concluirAuditoriaAction } from "@/lib/actions/auditorias";
import type { AuditoriaFilaItem, AuditoriasPainelData } from "@/lib/types/auditorias";
import { formatEspera, formatTempoMedio, formatUltimaCaptura } from "@/lib/auditorias/format";
import { formatDate, initials } from "@/lib/utils";

const criteria = [
  { id: "contatos", title: "Tentativas de contato registradas", help: "Ligações, mensagens ou e-mails constam no histórico." },
  { id: "comentarios", title: "Comentários atualizados", help: "O contexto e o próximo passo estão claros para a liderança." },
  { id: "status", title: "Etapas dos negócios corretas", help: "Cada oportunidade está na etapa correspondente no Bitrix24." },
  { id: "pendencias", title: "Sem pendências críticas", help: "Não há oportunidade parada sem justificativa ou retorno agendado." },
];

type QueueItem = AuditoriaFilaItem & { iniciais: string };

function mapQueue(fila: AuditoriaFilaItem[]): QueueItem[] {
  return fila.map((item) => ({ ...item, iniciais: initials(item.corretor) }));
}

export function AuditPanel({ data }: { data: AuditoriasPainelData }) {
  const router = useRouter();
  const [queue, setQueue] = useState(() => mapQueue(data.fila));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setQueue(mapQueue(data.fila));
  }, [data.fila]);

  const selected = useMemo(() => queue.find((item) => item.id === selectedId), [queue, selectedId]);
  const variacaoLabel = data.tempo_medio_variacao_min === 0
    ? "sem variação nesta semana"
    : `${data.tempo_medio_variacao_min > 0 ? "−" : "+"} ${Math.abs(data.tempo_medio_variacao_min)} min nesta semana`;

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

  async function conclude(approved: boolean) {
    if (!selected) return;

    setPending(true);
    setError("");

    const criterios = criteria.map((item) => ({ id: item.id, atendido: Boolean(checked[item.id]) }));
    const result = await concluirAuditoriaAction({
      auditoriaId: selected.id,
      approved,
      observacoes: notes,
      criterios,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setQueue((current) => current.filter((item) => item.id !== selected.id));
    setToast(approved ? `${selected.corretor} recebeu um novo lote.` : `${selected.corretor} foi bloqueado até regularizar a carteira.`);
    setSelectedId(null);
    setChecked({});
    setNotes("");
    router.refresh();
    setTimeout(() => setToast(""), 3800);
  }

  return (
    <>
      {toast ? <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button type="button" onClick={() => setToast("")} aria-label="Fechar"><X size={16} /></button></div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="audit-stats">
        <div><span className="stat-symbol stat-warning"><Clock3 size={19} /></span><span><strong>{queue.length}</strong><small>Aguardando auditoria</small></span></div>
        <div><span className="stat-symbol stat-success"><Check size={19} /></span><span><strong>{data.aprovadas_semana}</strong><small>Aprovadas esta semana</small></span></div>
        <div><span className="stat-symbol stat-danger"><ShieldAlert size={19} /></span><span><strong>{data.bloqueados}</strong><small>Corretores bloqueados</small></span></div>
        <div className="stat-context"><small>Tempo médio até auditoria</small><strong>{formatTempoMedio(data.tempo_medio_horas)}</strong><span>{variacaoLabel}</span></div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Fila de auditoria</h2>
            <p>Prioridade pelo tempo de espera. A carteira entra na fila já na primeira captura do dia.</p>
          </div>
          <span className="sync-label"><RefreshCw size={14} />Sincronizado {formatDate(data.gerado_em)}</span>
        </div>

        {queue.length ? (
          <div className="audit-list">
            {queue.map((item, index) => (
              <article className="audit-row" key={item.id}>
                <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="avatar avatar-light">{item.iniciais}</span>
                <div className="audit-person">
                  <h3>{item.corretor}</h3>
                  <p>{item.equipe} · Última captura {formatUltimaCaptura(item.ultima_captura)}</p>
                </div>
                <div className="audit-metric"><span>Carteira</span><strong>{item.atualizados}/{item.capturados} atualizadas</strong></div>
                <div className={item.sem_contato ? "audit-metric metric-alert" : "audit-metric"}>
                  <span>Pendências</span>
                  <strong>{item.sem_contato ? `${item.sem_contato} sem contato` : "Nenhuma crítica"}</strong>
                </div>
                <div className="audit-metric"><span>Em espera</span><strong>{formatEspera(item.espera_minutos)}</strong></div>
                <button type="button" className="button button-secondary" onClick={() => setSelectedId(item.id)}>Auditar carteira<ArrowRight size={16} /></button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <CheckCircle2 size={28} />
            <h2>Fila em dia</h2>
            <p>Não há carteiras em captura hoje. Assim que um corretor captar a primeira oportunidade, ela aparece aqui.</p>
          </div>
        )}
      </section>

      {selected ? (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}>
          <aside ref={drawerRef} className="audit-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
            <header>
              <button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Voltar"><ChevronLeft size={20} /></button>
              <div><span>Auditoria de carteira</span><h2 id="audit-drawer-title">{selected.corretor}</h2></div>
              <button type="button" className="icon-button" onClick={() => setSelectedId(null)} aria-label="Fechar"><X size={20} /></button>
            </header>
            <div className="drawer-summary">
              <div>
                <span className="avatar avatar-light">{selected.iniciais}</span>
                <span><strong>{selected.capturados} oportunidades no lote</strong><small>{selected.atualizados} atualizadas · {selected.sem_contato} sem contato</small></span>
              </div>
              <button type="button" className="button button-quiet">Abrir no Bitrix24<ExternalLink size={15} /></button>
            </div>
            <div className="drawer-content">
              <div className="drawer-intro"><h3>Critérios operacionais</h3><p>Confira cada item no Bitrix24 antes de concluir.</p></div>
              {criteria.map((item) => (
                <label className="criteria-row" key={item.id}>
                  <input type="checkbox" checked={checked[item.id] ?? false} onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))} />
                  <span className="check-control"><Check size={15} /></span>
                  <span><strong>{item.title}</strong><small>{item.help}</small></span>
                </label>
              ))}
              <div className="field">
                <label htmlFor="notes"><MessageSquareText size={16} />Observações da liderança</label>
                <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre o que foi verificado e, se necessário, o que deve ser regularizado." rows={5} />
                <small>{notes.length}/1500 caracteres</small>
              </div>
            </div>
            <footer>
              <p>{Object.values(checked).filter(Boolean).length} de {criteria.length} critérios atendidos</p>
              <div>
                <button type="button" className="button button-danger" disabled={pending} onClick={() => conclude(false)}>Reprovar e bloquear</button>
                <button type="button" className="button button-primary" disabled={pending || Object.values(checked).filter(Boolean).length !== criteria.length} onClick={() => conclude(true)}>Aprovar e liberar lote</button>
              </div>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
