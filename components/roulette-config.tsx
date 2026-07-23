"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, Filter, Search, SlidersHorizontal } from "lucide-react";
import { salvarPermissoesRoletas } from "@/lib/actions/roletas";
import type { RoletasConfigData } from "@/lib/types/roletas";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { initials } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

function statusBadge(status: RoletasConfigData["corretores"][number]["status"]) {
  if (status === "bloqueado") return <StatusBadge tone="danger">Bloqueado</StatusBadge>;
  if (status === "auditoria") return <StatusBadge tone="warning">Em auditoria</StatusBadge>;
  return <StatusBadge tone="success">Liberado</StatusBadge>;
}

export function RouletteConfig({ data }: { data: RoletasConfigData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [equipeFilter, setEquipeFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(data.corretores.map((item) => [item.id, [...item.roletas]])),
  );
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");

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
    return data.corretores.filter((item) => {
      if (equipeFilter === "__sem_equipe__" && item.equipeNome) return false;
      if (equipeFilter && equipeFilter !== "__sem_equipe__" && item.equipeNome !== equipeFilter) return false;
      if (!search) return true;
      return [item.nome, item.email, item.equipeNome ?? ""].join(" ").toLowerCase().includes(search);
    });
  }, [data.corretores, equipeFilter, query]);

  const hasActiveFilters = Boolean(query.trim() || equipeFilter);

  const permissionColumns = `minmax(240px, 1.65fr) minmax(132px, 0.95fr) repeat(${data.roletas.length}, minmax(128px, 1fr)) minmax(108px, 0.75fr)`;

  function toggle(corretorId: string, roletaId: string) {
    setSaved(false);
    setError("");
    setSelected((current) => ({
      ...current,
      [corretorId]: current[corretorId]?.includes(roletaId)
        ? current[corretorId].filter((id) => id !== roletaId)
        : [...(current[corretorId] ?? []), roletaId],
    }));
  }

  function saveChanges() {
    if (!hasSupabaseEnv()) {
      setError("Configure o Supabase para salvar permissões reais.");
      return;
    }

    setError("");
    startSaving(async () => {
      const result = await salvarPermissoesRoletas({
        atribuicoes: data.corretores.map((corretor) => ({
          corretorId: corretor.id,
          roletaIds: selected[corretor.id] ?? [],
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2400);
    });
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <span className="sr-only">Buscar corretor</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" />
        </label>
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
        <span className="toolbar-spacer" />
        <button type="button" className="button button-primary" disabled={saving || !data.corretores.length} onClick={saveChanges}>
          {saved ? <><Check size={17} />Alterações salvas</> : saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="config-summary">
        <span>
          <SlidersHorizontal size={18} />
          <strong>
            {filtered.length} corretor{filtered.length === 1 ? "" : "es"}
            {hasActiveFilters ? " encontrado" + (filtered.length === 1 ? "" : "s") : " no total"}
          </strong>
        </span>
        <p>Marque as roletas que cada corretor pode visualizar e captar.</p>
      </div>

      {data.roletas.length === 0 ? (
        <div className="empty-state">
          <SlidersHorizontal size={24} />
          <h2>Nenhuma roleta cadastrada</h2>
          <p>Quando as roletas estiverem no banco, as permissões aparecerão aqui.</p>
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length === 0 ? (
        <div className="empty-state">
          <SlidersHorizontal size={24} />
          <h2>Nenhum corretor sincronizado</h2>
          <p>As roletas já existem, mas ainda não há corretores ativos sincronizados. Rode o sync de pessoas do Bitrix.</p>
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length > 0 ? (
        <div className="permission-table" style={{ "--permission-columns": permissionColumns } as CSSProperties}>
          <div className="permission-head">
            <span className="permission-col permission-col-broker">Corretor</span>
            <span className="permission-col permission-col-team">Equipe</span>
            {data.roletas.map((roulette) => (
              <span key={roulette.id} className="permission-col permission-col-roleta">
                {roulette.nome}
                <small>{roulette.disponiveis} oportunidades</small>
              </span>
            ))}
            <span className="permission-col permission-col-status">Situação</span>
          </div>
          {filtered.map((broker) => (
            <div className="permission-row" key={broker.id}>
              <span className="broker-cell permission-col permission-col-broker">
                <span className="avatar avatar-light">{initials(broker.nome)}</span>
                <span><strong>{broker.nome}</strong><small>{broker.email}</small></span>
              </span>
              <span className="team-cell permission-col permission-col-team">{broker.equipeNome ?? "Sem equipe"}</span>
              {data.roletas.map((roulette) => (
                <span key={roulette.id} className="permission-toggle permission-col permission-col-roleta">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected[broker.id]?.includes(roulette.id) ?? false}
                      onChange={() => toggle(broker.id, roulette.id)}
                    />
                    <span aria-hidden="true"><Check size={14} /></span>
                    <em className="sr-only">{roulette.nome} para {broker.nome}</em>
                  </label>
                </span>
              ))}
              <span className="permission-col permission-col-status">{statusBadge(broker.status)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {data.roletas.length > 0 && data.corretores.length > 0 && filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={24} />
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
    </>
  );
}
