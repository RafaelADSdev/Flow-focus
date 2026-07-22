"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Clock3, LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import { oportunidades, roletas } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export function BrokerPanel() {
  const [captured, setCaptured] = useState(4);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const limit = 6;
  async function capture(id: string) {
    setLoadingId(id); setMessage(""); await new Promise((resolve) => setTimeout(resolve, 700));
    setCaptured((value) => Math.min(value + 1, limit)); setLoadingId(null); setMessage("Oportunidade captada e vinculada a sua carteira no Bitrix24.");
  }
  return <>
    <section className="broker-overview">
      <div className="limit-copy"><span className="limit-label">Seu limite de hoje</span><div><strong>{captured}</strong><span>de {limit} oportunidades</span></div><p>{limit - captured > 0 ? `Voce ainda pode captar ${limit - captured} oportunidades.` : "Lote completo. Trabalhe a carteira e aguarde a auditoria."}</p></div>
      <div className="progress-block" aria-label={`${captured} de ${limit} oportunidades captadas`}><div className="progress-track"><span style={{ width: `${(captured / limit) * 100}%` }} /></div><div className="progress-scale"><span>Inicio</span><span>Limite diario</span></div></div>
      <div className="cycle-state"><span className="state-icon"><Clock3 size={20} /></span><span><small>Estado do ciclo</small><strong>{captured === limit ? "Auditoria pendente" : "Captacao liberada"}</strong></span></div>
    </section>
    {message && <div className="success-banner" role="status"><Check size={18} />{message}<button onClick={() => setMessage("")} aria-label="Fechar aviso">×</button></div>}
    <section className="section-block"><div className="section-heading"><div><h2>Roletas disponiveis</h2><p>As oportunidades sao atribuidas automaticamente ao captar.</p></div><span className="sync-label"><RefreshCw size={14} />Sincronizado agora</span></div>
      <div className="roulette-list">{roletas.map((roulette) => <article className="roulette-row" key={roulette.id}>
        <span className={`roulette-signal signal-${roulette.tom}`}><Sparkles size={18} /></span>
        <div className="roulette-copy"><h3>{roulette.nome}</h3><p>{roulette.descricao}</p></div>
        <div className="available-count"><strong>{roulette.disponiveis}</strong><span>disponiveis</span></div>
        <button className="button button-secondary" disabled={captured >= limit || loadingId !== null} onClick={() => capture(roulette.id)}>{loadingId === roulette.id ? <><RefreshCw size={16} className="spin" />Captando</> : captured >= limit ? <><LockKeyhole size={16} />Limite atingido</> : <>Captar oportunidade<ArrowUpRight size={16} /></>}</button>
      </article>)}</div>
    </section>
    <section className="section-block"><div className="section-heading"><div><h2>Capturas recentes</h2><p>Continue o atendimento e os registros diretamente no Bitrix24.</p></div><button className="text-button">Ver historico completo</button></div>
      <div className="data-table"><div className="table-head"><span>Oportunidade</span><span>Roleta</span><span>Captada em</span><span>Valor estimado</span><span>Status</span></div>{oportunidades.map((item) => <div className="table-row" key={item.id}><span data-label="Oportunidade"><strong>{item.titulo}</strong><small>#{item.id}</small></span><span data-label="Roleta">{item.roleta}</span><span data-label="Captada em">{formatDate(item.captadaEm)}</span><span data-label="Valor">{formatCurrency(item.valor)}</span><span data-label="Status"><StatusBadge tone={item.status === "Comentario pendente" ? "warning" : "success"}>{item.status}</StatusBadge></span></div>)}</div>
    </section>
  </>;
}
