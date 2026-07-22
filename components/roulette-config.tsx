"use client";

import { useMemo, useState } from "react";
import { Check, Filter, Search, SlidersHorizontal } from "lucide-react";
import { corretores, roletas } from "@/lib/mock-data";
import { initials } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export function RouletteConfig() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(corretores.map((item) => [item.id, [...item.roletas]])));
  const [saved, setSaved] = useState(false);
  const filtered = useMemo(() => corretores.filter((item) => item.nome.toLowerCase().includes(query.toLowerCase())), [query]);
  function toggle(corretorId: string, roletaId: string) { setSaved(false); setSelected((current) => ({ ...current, [corretorId]: current[corretorId]?.includes(roletaId) ? current[corretorId].filter((id) => id !== roletaId) : [...(current[corretorId] ?? []), roletaId] })); }
  return <>
    <div className="toolbar"><label className="search-box"><Search size={18} /><span className="sr-only">Buscar corretor</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label><button className="button button-quiet"><Filter size={16} />Equipe Jordao</button><span className="toolbar-spacer"/><button className="button button-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2400); }}>{saved ? <><Check size={17} />Alteracoes salvas</> : "Salvar alteracoes"}</button></div>
    <div className="config-summary"><span><SlidersHorizontal size={18}/><strong>{corretores.length} corretores</strong> nesta equipe</span><p>Marque as roletas que cada corretor pode visualizar e captar.</p></div>
    <div className="permission-table"><div className="permission-head"><span>Corretor</span>{roletas.map((roulette) => <span key={roulette.id}>{roulette.nome}<small>{roulette.disponiveis} oportunidades</small></span>)}<span>Situacao</span></div>
      {filtered.map((broker) => <div className="permission-row" key={broker.id}><span className="broker-cell"><span className="avatar avatar-light">{initials(broker.nome)}</span><span><strong>{broker.nome}</strong><small>{broker.email}</small></span></span>{roletas.map((roulette) => <span key={roulette.id} className="permission-toggle"><label><input type="checkbox" checked={selected[broker.id]?.includes(roulette.id) ?? false} onChange={() => toggle(broker.id, roulette.id)} /><span aria-hidden="true"><Check size={14}/></span><em className="sr-only">{roulette.nome} para {broker.nome}</em></label></span>)}<span>{broker.status === "bloqueado" ? <StatusBadge tone="danger">Bloqueado</StatusBadge> : broker.status === "auditoria" ? <StatusBadge tone="warning">Em auditoria</StatusBadge> : <StatusBadge tone="success">Liberado</StatusBadge>}</span></div>)}
    </div>
    {!filtered.length && <div className="empty-state"><Search size={24}/><h2>Nenhum corretor encontrado</h2><p>Tente buscar por outro nome ou limpe o campo de pesquisa.</p><button className="button button-secondary" onClick={() => setQuery("")}>Limpar busca</button></div>}
  </>;
}
