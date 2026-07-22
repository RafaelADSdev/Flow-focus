"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronLeft, Clock3, ExternalLink, MessageSquareText, ShieldAlert, X } from "lucide-react";
import { auditoriasPendentes } from "@/lib/mock-data";

const criteria = [
  { id: "contatos", title: "Tentativas de contato registradas", help: "Ligacoes, mensagens ou e-mails constam no historico." },
  { id: "comentarios", title: "Comentarios atualizados", help: "O contexto e o proximo passo estao claros para a lideranca." },
  { id: "status", title: "Etapas dos negocios corretas", help: "Cada oportunidade esta na etapa correspondente no Bitrix24." },
  { id: "pendencias", title: "Sem pendencias criticas", help: "Nao ha oportunidade parada sem justificativa ou retorno agendado." },
];

export function AuditPanel() {
  const [queue, setQueue] = useState([...auditoriasPendentes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const selected = queue.find((item) => item.id === selectedId);

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
  function conclude(approved: boolean) {
    if (!selected) return;
    setQueue((current) => current.filter((item) => item.id !== selected.id));
    setToast(approved ? `${selected.corretor} recebeu um novo lote.` : `${selected.corretor} foi bloqueado ate regularizar a carteira.`);
    setSelectedId(null); setChecked({}); setNotes(""); setTimeout(() => setToast(""), 3800);
  }
  return <>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button onClick={() => setToast("")} aria-label="Fechar"><X size={16}/></button></div>}
    <section className="audit-stats"><div><span className="stat-symbol stat-warning"><Clock3 size={19}/></span><span><strong>{queue.length}</strong><small>Aguardando auditoria</small></span></div><div><span className="stat-symbol stat-success"><Check size={19}/></span><span><strong>8</strong><small>Aprovadas esta semana</small></span></div><div><span className="stat-symbol stat-danger"><ShieldAlert size={19}/></span><span><strong>2</strong><small>Corretores bloqueados</small></span></div><div className="stat-context"><small>Tempo medio ate auditoria</small><strong>6h 18min</strong><span>− 42 min nesta semana</span></div></section>
    <section className="section-block"><div className="section-heading"><div><h2>Fila de auditoria</h2><p>Prioridade ordenada pelo maior tempo de espera.</p></div><span className="sync-label">Atualizado agora</span></div>
      {queue.length ? <div className="audit-list">{queue.map((item, index) => <article className="audit-row" key={item.id}>
        <span className="queue-index">{String(index + 1).padStart(2, "0")}</span><span className="avatar avatar-light">{item.iniciais}</span>
        <div className="audit-person"><h3>{item.corretor}</h3><p>{item.equipe} · Ultima captura {item.ultimaCaptura}</p></div>
        <div className="audit-metric"><span>Carteira</span><strong>{item.atualizados}/{item.capturados} atualizadas</strong></div>
        <div className={item.semContato ? "audit-metric metric-alert" : "audit-metric"}><span>Pendencias</span><strong>{item.semContato ? `${item.semContato} sem contato` : "Nenhuma critica"}</strong></div>
        <div className="audit-metric"><span>Em espera</span><strong>{item.espera}</strong></div>
        <button className="button button-secondary" onClick={() => setSelectedId(item.id)}>Auditar carteira<ArrowRight size={16}/></button>
      </article>)}</div> : <div className="empty-state"><CheckCircle2 size={28}/><h2>Fila em dia</h2><p>Nao ha carteiras aguardando auditoria neste momento.</p></div>}
    </section>
    {selected && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><aside ref={drawerRef} className="audit-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
      <header><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="Voltar"><ChevronLeft size={20}/></button><div><span>Auditoria de carteira</span><h2 id="audit-drawer-title">{selected.corretor}</h2></div><button className="icon-button" onClick={() => setSelectedId(null)} aria-label="Fechar"><X size={20}/></button></header>
      <div className="drawer-summary"><div><span className="avatar avatar-light">{selected.iniciais}</span><span><strong>{selected.capturados} oportunidades no lote</strong><small>{selected.atualizados} atualizadas · {selected.semContato} sem contato</small></span></div><button className="button button-quiet">Abrir no Bitrix24<ExternalLink size={15}/></button></div>
      <div className="drawer-content"><div className="drawer-intro"><h3>Critérios operacionais</h3><p>Confira cada item no Bitrix24 antes de concluir.</p></div>{criteria.map((item) => <label className="criteria-row" key={item.id}><input type="checkbox" checked={checked[item.id] ?? false} onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))}/><span className="check-control"><Check size={15}/></span><span><strong>{item.title}</strong><small>{item.help}</small></span></label>)}
        <div className="field"><label htmlFor="notes"><MessageSquareText size={16}/>Observacoes da lideranca</label><textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre o que foi verificado e, se necessario, o que deve ser regularizado." rows={5}/><small>{notes.length}/1500 caracteres</small></div>
      </div>
      <footer><p>{Object.values(checked).filter(Boolean).length} de {criteria.length} criterios atendidos</p><div><button className="button button-danger" onClick={() => conclude(false)}>Reprovar e bloquear</button><button className="button button-primary" onClick={() => conclude(true)} disabled={Object.values(checked).filter(Boolean).length !== criteria.length}>Aprovar e liberar lote</button></div></footer>
    </aside></div>}
  </>;
}
