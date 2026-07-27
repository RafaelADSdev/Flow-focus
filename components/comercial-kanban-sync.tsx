"use client";

import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { sincronizarComercialGeralBitrix } from "@/lib/actions/sync-leads";

const AUTO_SYNC_MS = 5 * 60 * 1000;
const AUTO_SYNC_LEASE_KEY = "flow-focus:comercial-geral:last-sync";

function formatSyncTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function claimAutomaticSync() {
  try {
    const now = Date.now();
    const previous = Number(window.localStorage.getItem(AUTO_SYNC_LEASE_KEY) ?? 0);
    if (Number.isFinite(previous) && now - previous < AUTO_SYNC_MS - 5_000) return false;
    window.localStorage.setItem(AUTO_SYNC_LEASE_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function recordAutomaticSync(value: number | null) {
  try {
    if (value === null) window.localStorage.removeItem(AUTO_SYNC_LEASE_KEY);
    else window.localStorage.setItem(AUTO_SYNC_LEASE_KEY, String(value));
  } catch {
    // Storage can be unavailable in private browsing; server-side locking still applies.
  }
}

export function ComercialKanbanSync({ initialSyncedAt }: { initialSyncedAt: string }) {
  const router = useRouter();
  const syncingRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(initialSyncedAt);
  const [now, setNow] = useState(() => Date.parse(initialSyncedAt));
  const [nextSyncAt, setNextSyncAt] = useState(() => Date.parse(initialSyncedAt) + AUTO_SYNC_MS);
  const [error, setError] = useState("");

  const sync = useCallback(async (source: "manual" | "auto") => {
    if (syncingRef.current) return;
    if (source === "auto") {
      if (document.visibilityState === "hidden") return;
      if (!claimAutomaticSync()) {
        setNextSyncAt(Date.now() + AUTO_SYNC_MS);
        return;
      }
    }

    syncingRef.current = true;
    lastAttemptRef.current = Date.now();
    setNextSyncAt(lastAttemptRef.current + AUTO_SYNC_MS);
    setSyncing(true);
    setError("");

    try {
      const result = await sincronizarComercialGeralBitrix();
      if (!result.ok) {
        setError(result.error);
        if (source === "auto") recordAutomaticSync(null);
        return;
      }

      recordAutomaticSync(Date.now());
      setLastSyncedAt(result.syncedAt);
      setNextSyncAt(Date.parse(result.syncedAt) + AUTO_SYNC_MS);
      router.refresh();
    } catch {
      setError("Não foi possível concluir a sincronização.");
      if (source === "auto") recordAutomaticSync(null);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [router]);

  useEffect(() => {
    lastAttemptRef.current = Date.now();
    setNow(lastAttemptRef.current);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const timer = window.setInterval(() => void sync("auto"), AUTO_SYNC_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastAttemptRef.current >= AUTO_SYNC_MS) {
        void sync("auto");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [sync]);

  return (
    <div className="kanban-sync-control">
      <button
        type="button"
        className="button button-secondary"
        disabled={syncing}
        aria-busy={syncing}
        onClick={() => void sync("manual")}
      >
        <RefreshCw size={16} className={syncing ? "spin" : undefined} aria-hidden="true" />
        {syncing ? "Sincronizando..." : "Sincronizar dados"}
      </button>
      <div className={`kanban-sync-meta${error ? " is-error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">
        {syncing ? (
          <span className="kanban-sync-state"><RefreshCw className="spin" size={13} aria-hidden="true" />Atualizando Bitrix e Supabase</span>
        ) : error ? (
          <span className="kanban-sync-state">{error}</span>
        ) : (
          <>
            <span><CheckCircle2 size={13} aria-hidden="true" /><span>Atualizado às</span><strong>{formatSyncTime(lastSyncedAt)}</strong></span>
            <span><Clock3 size={13} aria-hidden="true" /><span>Próxima sync</span><strong>{formatCountdown(nextSyncAt - now)}</strong></span>
          </>
        )}
      </div>
    </div>
  );
}
