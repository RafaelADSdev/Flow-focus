"use client";

/**
 * THESIS: resultados são uma faixa de estados que abre a lista correspondente em modal, nunca um mosaico de cards.
 * OWN-WORLD: marfim operacional, divisores contínuos, preto para leitura e roxo apenas na seleção.
 * STORY: o usuário identifica o volume, escolhe um estado e chega ao lead no Bitrix24.
 * FIRST VIEWPORT: seis indicadores em uma régua única; a lista abre sob demanda.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  CircleDollarSign,
  Inbox,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { ResultsCapturaCharts } from "@/components/results-captura-charts";
import { ResultsLeadsDialog } from "@/components/results-leads-dialog";
import { sincronizarResultadosBitrix } from "@/lib/actions/resultados";
import { createClient } from "@/lib/supabase/client";
import type { ResultadoBucket, ResultadosData } from "@/lib/types/resultados";
import { formatDate } from "@/lib/utils";

const AUTO_SYNC_MS = 2 * 60 * 1000;

const metrics = [
  { key: "total", label: "Total de Leads Captados", icon: Inbox, tone: "neutral" },
  { key: "andamento", label: "Leads Em Andamento", icon: TrendingUp, tone: "info" },
  { key: "vendas", label: "Contratos Assinados", icon: CircleDollarSign, tone: "success" },
  { key: "perdidos", label: "Negócios Perdidos", icon: XCircle, tone: "danger" },
  { key: "retornaram", label: "Leads Retornaram para o Bolsão", icon: ArchiveRestore, tone: "warning" },
  { key: "quarentena", label: "Leads em Quarentena", icon: ShieldAlert, tone: "warning" },
] as const;

export function ResultsPanel({ data, bitrixPortalBase = "" }: { data: ResultadosData; bitrixPortalBase?: string }) {
  const router = useRouter();
  const [openBucket, setOpenBucket] = useState<ResultadoBucket | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(data.geradoEm);
  const [error, setError] = useState("");
  const [isRefreshing, startRefresh] = useTransition();
  const syncingRef = useRef(false);

  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  const sync = useCallback(async (manual: boolean) => {
    if (syncingRef.current || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    syncingRef.current = true;
    setSyncing(true);
    if (manual) setError("");
    try {
      const result = await sincronizarResultadosBitrix();
      if (!result.ok) {
        if (manual) setError(result.error);
        return;
      }
      setLastSyncedAt(result.syncedAt);
      refresh();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("flow-focus-resultados")
      .on("postgres_changes", { event: "*", schema: "public", table: "oportunidades" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => void sync(false), AUTO_SYNC_MS);
    return () => window.clearInterval(timer);
  }, [sync]);

  const activeLabel = metrics.find((metric) => metric.key === openBucket)?.label ?? "Leads";
  const displayedSyncedAt = Date.parse(lastSyncedAt) >= Date.parse(data.geradoEm) ? lastSyncedAt : data.geradoEm;

  return (
    <>
      <section className="results-strip" aria-label="Indicadores de resultados">
        {metrics.map(({ key, label, icon: Icon, tone }) => (
          <button
            key={key}
            type="button"
            className={`results-metric results-metric--${tone}${openBucket === key ? " is-active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={openBucket === key}
            onClick={() => setOpenBucket(key)}
          >
            <span><Icon size={18} strokeWidth={1.8} aria-hidden />{label}</span>
            <strong>{data.indicadores[key]}</strong>
          </button>
        ))}
      </section>

      <div className="results-sync-bar">
        <div className="sync-control">
          <button type="button" className="button button-quiet sync-button" disabled={syncing || isRefreshing} onClick={() => void sync(true)}>
            <RefreshCw size={14} className={syncing ? "spin" : undefined} aria-hidden />
            {syncing ? "Sincronizando…" : "Sincronizar Bitrix24"}
          </button>
          <span className="sync-label">Atualizado {formatDate(displayedSyncedAt)}</span>
        </div>
        <p className="results-sync-note">Somente leads capturados pelas roletas do Flow Focus.</p>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <ResultsCapturaCharts
        capturasPorEquipe={data.capturasPorEquipe}
        topCorretores={data.topCorretores}
        totalCapturados={data.indicadores.total}
      />

      <ResultsLeadsDialog
        bucket={openBucket}
        label={activeLabel}
        leads={data.leads}
        bitrixPortalBase={bitrixPortalBase}
        isRefreshing={isRefreshing}
        onClose={() => setOpenBucket(null)}
      />
    </>
  );
}
