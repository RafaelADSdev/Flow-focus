"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Filter, Search, SlidersHorizontal } from "lucide-react";
import type { RoletasConfigData } from "@/lib/types/roletas";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
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
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(data.corretores.map((item) => [item.id, [...item.roletas]])),
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(
    () => data.corretores.filter((item) => [item.nome, item.email].join(" ").toLowerCase().includes(query.toLowerCase())),
    [data.corretores, query],
  );

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

  async function saveChanges() {
    if (!hasSupabaseEnv()) {
      setError("Configure o Supabase para salvar permissões reais.");
      return;
    }

    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setError("Sessão expirada. Faça login novamente.");
      setSaving(false);
      return;
    }

    for (const corretor of data.corretores) {
      const desired = new Set(selected[corretor.id] ?? []);
      const current = new Set(corretor.roletas);
      const toAdd = [...desired].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !desired.has(id));

      if (toRemove.length) {
        const { error: deleteError } = await supabase
          .from("roletas_corretor")
          .delete()
          .eq("corretor_id", corretor.id)
          .in("roleta_id", toRemove);
        if (deleteError) {
          setError("Não foi possível atualizar as permissões.");
          setSaving(false);
          return;
        }
      }

      if (toAdd.length) {
        const { error: insertError } = await supabase.from("roletas_corretor").insert(
          toAdd.map((roletaId) => ({
            corretor_id: corretor.id,
            roleta_id: roletaId,
            liberado_por: userId,
          })),
        );
        if (insertError) {
          setError("Não foi possível salvar as novas permissões.");
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2400);
  }

  return (
    <>
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <span className="sr-only">Buscar corretor</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" />
        </label>
        <button type="button" className="button button-quiet"><Filter size={16} />{data.equipe_nome}</button>
        <span className="toolbar-spacer" />
        <button type="button" className="button button-primary" disabled={saving || !data.corretores.length} onClick={saveChanges}>
          {saved ? <><Check size={17} />Alterações salvas</> : saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="config-summary">
        <span><SlidersHorizontal size={18} /><strong>{data.corretores.length} corretores</strong> nesta equipe</span>
        <p>Marque as roletas que cada corretor pode visualizar e captar.</p>
      </div>

      {data.roletas.length && data.corretores.length ? (
        <div className="permission-table">
          <div className="permission-head">
            <span>Corretor</span>
            {data.roletas.map((roulette) => (
              <span key={roulette.id}>{roulette.nome}<small>{roulette.disponiveis} oportunidades</small></span>
            ))}
            <span>Situação</span>
          </div>
          {filtered.map((broker) => (
            <div className="permission-row" key={broker.id}>
              <span className="broker-cell">
                <span className="avatar avatar-light">{initials(broker.nome)}</span>
                <span><strong>{broker.nome}</strong><small>{broker.email}</small></span>
              </span>
              {data.roletas.map((roulette) => (
                <span key={roulette.id} className="permission-toggle">
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
              <span>{statusBadge(broker.status)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <SlidersHorizontal size={24} />
          <h2>Nenhum corretor ou roleta cadastrada</h2>
          <p>Quando a equipe e as roletas estiverem no banco, as permissões aparecerão aqui.</p>
        </div>
      )}

      {data.corretores.length > 0 && filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={24} />
          <h2>Nenhum corretor encontrado</h2>
          <p>Tente buscar por outro nome ou limpe o campo de pesquisa.</p>
          <button type="button" className="button button-secondary" onClick={() => setQuery("")}>Limpar busca</button>
        </div>
      ) : null}
    </>
  );
}
