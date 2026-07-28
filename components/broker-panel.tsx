"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Clock3,
  ExternalLink,
  Inbox,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { captarOportunidade } from "@/lib/actions/captura";
import { sincronizarLeadsBitrix } from "@/lib/actions/sync-leads";
import type { CarteiraData } from "@/lib/types/carteira";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const roletaTones = ["violet", "teal", "amber"] as const;
const AUTO_SYNC_MS = 5 * 60 * 1000;

const statusLabels: Record<CarteiraData["capturas_recentes"][number]["status"], string> = {
  disponivel: "Disponível",
  captada: "Captada",
  em_trabalho: "Em contato",
  convertida: "Convertida",
  perdida: "Perdida",
};

const statusTones: Record<
  CarteiraData["capturas_recentes"][number]["status"],
  "success" | "warning" | "danger" | "neutral" | "info"
> = {
  disponivel: "neutral",
  captada: "info",
  em_trabalho: "success",
  convertida: "success",
  perdida: "danger",
};

const cycleMeta: Record<
  CarteiraData["estado_ciclo"],
  { label: string; icon: typeof Check; tone: "ok" | "warn" | "danger" }
> = {
  captacao_liberada: { label: "Captação liberada", icon: Check, tone: "ok" },
  auditoria_pendente: { label: "Auditoria pendente", icon: Clock3, tone: "warn" },
  bloqueado: { label: "Captação bloqueada", icon: LockKeyhole, tone: "danger" },
};

function dealUrl(portalBase: string, dealId: string) {
  const id = dealId.trim();
  if (!portalBase || !id) return null;
  return `${portalBase}/crm/deal/details/${encodeURIComponent(id)}/`;
}

function toneForRoleta(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % 997;
  }
  return roletaTones[hash % roletaTones.length];
}

function defaultRoletaId(roletas: CarteiraData["roletas"]) {
  const withStock = roletas.find((item) => item.tem_disponiveis);
  return withStock?.id ?? roletas[0]?.id ?? null;
}

function captureGateLabel(estadoCiclo: CarteiraData["estado_ciclo"], capturados: number, limite: number) {
  if (estadoCiclo === "bloqueado") {
    return {
      label: "Captação bloqueada",
      title: "Captação bloqueada. Aguarde a liberação da liderança.",
      icon: <LockKeyhole size={16} aria-hidden />,
    };
  }
  if (estadoCiclo === "auditoria_pendente") {
    return {
      label: "Auditoria pendente",
      title: "Lote em auditoria. Trabalhe as capturas no Bitrix24 até a liberação.",
      icon: <Clock3 size={16} aria-hidden />,
    };
  }
  if (capturados >= limite) {
    return {
      label: "Limite atingido",
      title: "Limite diário atingido. Trabalhe a carteira e aguarde a auditoria.",
      icon: <LockKeyhole size={16} aria-hidden />,
    };
  }
  return null;
}

function capturaMatchesRoleta(
  captura: CarteiraData["capturas_recentes"][number],
  roletaId: string,
  roletaNome: string,
) {
  if (roletaId && captura.roleta_id) return captura.roleta_id === roletaId;
  return captura.roleta === roletaNome;
}

export function BrokerPanel({
  data,
  bitrixPortalBase = "",
}: {
  data: CarteiraData;
  bitrixPortalBase?: string;
}) {
  const router = useRouter();
  const cycleStatusId = useId();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [lastSyncedAt, setLastSyncedAt] = useState(data.gerado_em);
  const [message, setMessage] = useState("");
  const [messageLink, setMessageLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [limitPulse, setLimitPulse] = useState(false);
  const [cyclePulse, setCyclePulse] = useState(false);
  const [highlightDealId, setHighlightDealId] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [selectedRoletaId, setSelectedRoletaId] = useState<string | null>(() => defaultRoletaId(data.roletas));
  const [showAllCapturas, setShowAllCapturas] = useState(false);
  const syncingRef = useRef(false);
  const prevCapturadosRef = useRef(data.capturados);
  const prevEstadoRef = useRef(data.estado_ciclo);

  const { capturados, limite, estado_ciclo: estadoCiclo, roletas, capturas_recentes: capturasRecentes } = data;
  const selectedRoleta = roletas.find((item) => item.id === selectedRoletaId) ?? null;
  const restante = Math.max(0, limite - capturados);
  const cicloLiberado = estadoCiclo === "captacao_liberada";
  const limiteDiarioAtingido = capturados >= limite;
  const captacaoTravada = !cicloLiberado || limiteDiarioAtingido;
  const gate = captureGateLabel(estadoCiclo, capturados, limite);
  const progress = limite > 0 ? Math.min(100, (capturados / limite) * 100) : 0;
  const CycleIcon = cycleMeta[estadoCiclo].icon;
  const limitHint =
    estadoCiclo === "bloqueado"
      ? "Captação bloqueada. Aguarde a liberação da liderança."
      : estadoCiclo === "auditoria_pendente"
        ? "Lote em auditoria. Trabalhe as capturas no Bitrix24 até a liberação."
        : restante > 0
          ? `Você ainda pode captar ${restante} oportunidade${restante === 1 ? "" : "s"}.`
          : "Lote completo. Trabalhe a carteira e aguarde a auditoria.";

  const filteredCapturas =
    showAllCapturas || !selectedRoleta
      ? capturasRecentes
      : capturasRecentes.filter((item) =>
          capturaMatchesRoleta(item, selectedRoleta.id, selectedRoleta.nome),
        );

  const isPageBusy = syncing || loadingId !== null || isRefreshing;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProgressReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (selectedRoletaId && roletas.some((item) => item.id === selectedRoletaId)) return;
    setSelectedRoletaId(defaultRoletaId(roletas));
  }, [roletas, selectedRoletaId]);

  useEffect(() => {
    if (capturados > prevCapturadosRef.current) {
      setLimitPulse(true);
      const timer = window.setTimeout(() => setLimitPulse(false), 720);
      prevCapturadosRef.current = capturados;
      return () => window.clearTimeout(timer);
    }
    prevCapturadosRef.current = capturados;
  }, [capturados]);

  useEffect(() => {
    if (estadoCiclo === prevEstadoRef.current) return;
    setCyclePulse(true);
    const timer = window.setTimeout(() => setCyclePulse(false), 420);
    prevEstadoRef.current = estadoCiclo;
    return () => window.clearTimeout(timer);
  }, [estadoCiclo]);

  useEffect(() => {
    if (!highlightDealId) return;
    const timer = window.setTimeout(() => setHighlightDealId(null), 4200);
    return () => window.clearTimeout(timer);
  }, [highlightDealId]);

  const refreshData = useCallback(() => {
    startRefresh(() => {
      router.refresh();
    });
  }, [router]);

  const syncLeads = useCallback(async (source: "manual" | "auto") => {
    if (syncingRef.current) return;
    if (source === "auto" && typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    if (source === "manual") {
      setMessage("");
      setMessageLink(null);
      setError("");
    }

    try {
      const result = await sincronizarLeadsBitrix();
      if (!result.ok) {
        if (source === "manual") setError(result.error);
        return;
      }

      setLastSyncedAt(result.syncedAt);
      if (source === "manual") {
        setMessage("Fila atualizada com o Bitrix24.");
      }
      refreshData();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshData]);

  useEffect(() => {
    setLastSyncedAt(data.gerado_em);
  }, [data.gerado_em]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncLeads("auto");
    }, AUTO_SYNC_MS);

    return () => window.clearInterval(timer);
  }, [syncLeads]);

  async function capture(id: string) {
    setLoadingId(id);
    setMessage("");
    setMessageLink(null);
    setError("");

    const result = await captarOportunidade({ roletaId: id });

    setLoadingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const link = dealUrl(bitrixPortalBase, result.bitrixDealId);
    setMessage(
      result.titulo
        ? `“${result.titulo}” captada. Continue o atendimento no Bitrix24.`
        : "Oportunidade captada. Continue o atendimento no Bitrix24.",
    );
    setMessageLink(link);
    if (result.bitrixDealId) setHighlightDealId(result.bitrixDealId);
    setShowAllCapturas(false);
    refreshData();
  }

  function renderCaptureLabel(roulette: CarteiraData["roletas"][number]): ReactNode {
    if (loadingId === roulette.id) {
      return (
        <>
          <RefreshCw size={16} className="spin" aria-hidden />
          Captando
        </>
      );
    }
    if (gate) {
      return (
        <>
          {gate.icon}
          {gate.label}
        </>
      );
    }
    return (
      <>
        Captar oportunidade
        <ArrowUpRight size={16} aria-hidden />
      </>
    );
  }

  function captureButtonTitle(roulette: CarteiraData["roletas"][number]) {
    if (gate) return gate.title;
    if (syncing) return "Aguarde a sincronização terminar.";
    if (!roulette.tem_disponiveis) return "Sem oportunidades nesta roleta. Tente outra ou sincronize.";
    return undefined;
  }

  return (
    <>
      {isPageBusy ? (
        <div className="page-busy-bar" role="status" aria-live="polite">
          <RefreshCw size={14} className="is-spinning" aria-hidden="true" />
          <span>
            {loadingId ? "Captando oportunidade…" : syncing ? "Sincronizando leads…" : "Atualizando carteira…"}
          </span>
        </div>
      ) : null}

      <section className="broker-overview" aria-label="Limite diário e estado do ciclo">
        <div className="limit-copy">
          <span className="limit-label">Seu limite de hoje</span>
          <div>
            <strong key={capturados} className={`limit-count${limitPulse ? " is-ticking" : ""}`}>
              {capturados}
            </strong>
            <span>de {limite} oportunidades</span>
          </div>
          <p>{limitHint}</p>
        </div>
        <div
          className="progress-block"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={capturados}
          aria-label={`${capturados} de ${limite} oportunidades captadas`}
        >
          <div className="progress-track">
            <span
              className={`progress-fill${progressReady ? " is-ready" : ""}${limitPulse ? " is-pulsing" : ""}`}
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
          <div className="progress-scale">
            <span>Início</span>
            <span>Limite diário</span>
          </div>
        </div>
        <div
          id={cycleStatusId}
          className={`cycle-state cycle-state--${cycleMeta[estadoCiclo].tone}${cyclePulse ? " is-cycle-shift" : ""}`}
        >
          <span className="state-icon" key={estadoCiclo} aria-hidden>
            <CycleIcon size={20} />
          </span>
          <span>
            <small>Estado do ciclo</small>
            <strong key={estadoCiclo}>{cycleMeta[estadoCiclo].label}</strong>
          </span>
        </div>
      </section>

      {message ? (
        <div className="success-banner broker-feedback-in" role="status" aria-live="polite">
          <Check size={18} aria-hidden />
          <span className="success-banner-copy">
            {message}
            {messageLink ? (
              <a
                className="success-banner-link"
                href={messageLink}
                target="_blank"
                rel="noreferrer"
              >
                Abrir no Bitrix24
                <ExternalLink size={14} aria-hidden />
              </a>
            ) : null}
          </span>
          <button
            type="button"
            className="success-banner-dismiss"
            onClick={() => { setMessage(""); setMessageLink(null); }}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="section-block" aria-labelledby="broker-roletas-heading">
        <div className="section-heading">
          <div>
            <h2 id="broker-roletas-heading">Roletas disponíveis</h2>
            <p>Selecione a roleta e capture a próxima oportunidade da fila.</p>
          </div>
          <div className="sync-control">
            <button
              type="button"
              className="button button-quiet sync-button"
              disabled={isPageBusy}
              onClick={() => void syncLeads("manual")}
              aria-busy={syncing}
            >
              <RefreshCw size={14} className={syncing ? "spin" : undefined} aria-hidden />
              {syncing ? "Sincronizando…" : "Sincronizar leads"}
            </button>
            <span className="sync-label">
              {syncing ? "Atualizando fila do Bitrix24" : `Última sync ${formatDate(lastSyncedAt)}`}
            </span>
          </div>
        </div>

        {roletas.length ? (
          <>
            <div className="roulette-grid" role="listbox" aria-label="Roletas liberadas" aria-activedescendant={selectedRoletaId ?? undefined}>
              {roletas.map((roulette) => {
                const selected = selectedRoletaId === roulette.id;
                const tone = toneForRoleta(roulette.id);
                return (
                  <button
                    type="button"
                    key={roulette.id}
                    role="option"
                    aria-selected={selected}
                    className={`roulette-card signal-${tone}${selected ? " is-selected" : ""}${!roulette.tem_disponiveis ? " is-empty" : ""}`}
                    onClick={() => {
                      setSelectedRoletaId(roulette.id);
                      setShowAllCapturas(false);
                    }}
                  >
                    <span className={`roulette-signal signal-${tone}`} aria-hidden>
                      <Inbox size={18} />
                    </span>
                    <span className="roulette-card-copy">
                      <strong>{roulette.nome}</strong>
                      <small>{roulette.descricao || "Sem descrição cadastrada."}</small>
                    </span>
                    <span className="available-count">
                      <strong className="available-count-value">{roulette.disponiveis}</strong>
                      <span>na fila</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedRoleta ? (
              <div className={`roulette-capture-panel${loadingId === selectedRoleta.id ? " is-claiming" : ""}`}>
                <div className="roulette-capture-copy">
                  <strong>{selectedRoleta.nome}</strong>
                  <p>
                    {selectedRoleta.disponiveis > 0
                      ? `${selectedRoleta.disponiveis} oportunidade${selectedRoleta.disponiveis === 1 ? "" : "s"} disponível${selectedRoleta.disponiveis === 1 ? "" : "eis"} nesta roleta.`
                      : "Sem oportunidades nesta roleta no momento."}
                  </p>
                </div>
                <button
                  type="button"
                  className={`button ${
                    cicloLiberado &&
                    !limiteDiarioAtingido &&
                    selectedRoleta.tem_disponiveis &&
                    loadingId === null &&
                    !syncing &&
                    !isRefreshing
                      ? "button-primary"
                      : "button-secondary"
                  }`}
                  disabled={
                    captacaoTravada ||
                    loadingId !== null ||
                    syncing ||
                    isRefreshing ||
                    !selectedRoleta.tem_disponiveis
                  }
                  title={captureButtonTitle(selectedRoleta)}
                  aria-describedby={gate ? cycleStatusId : undefined}
                  onClick={() => capture(selectedRoleta.id)}
                >
                  {renderCaptureLabel(selectedRoleta)}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <Inbox size={24} aria-hidden />
            <h3>Nenhuma roleta liberada</h3>
            <p>Quando a liderança liberar campanhas para você, elas aparecerão aqui para captação.</p>
          </div>
        )}
      </section>

      <section className="section-block" aria-labelledby="broker-capturas-heading">
        <div className="section-heading">
          <div>
            <h2 id="broker-capturas-heading">Capturas recentes</h2>
            <p>
              {selectedRoleta && !showAllCapturas
                ? `Mostrando capturas da roleta ${selectedRoleta.nome}.`
                : "Continue o atendimento e os registros diretamente no Bitrix24."}
            </p>
          </div>
          {selectedRoleta && capturasRecentes.length > 0 ? (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setShowAllCapturas((value) => !value)}
            >
              {showAllCapturas ? "Filtrar por roleta" : "Ver todas as roletas"}
            </button>
          ) : null}
        </div>

        {filteredCapturas.length ? (
          <div className="data-table" role="table" aria-label="Capturas recentes">
            <div className="table-head" role="row">
              <span role="columnheader">Oportunidade</span>
              <span role="columnheader">Roleta</span>
              <span role="columnheader">Captada em</span>
              <span role="columnheader">Valor estimado</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Bitrix</span>
            </div>
            {filteredCapturas.map((item) => {
              const link = dealUrl(bitrixPortalBase, item.bitrix_deal_id);
              const isFresh = highlightDealId !== null && item.bitrix_deal_id === highlightDealId;
              return (
                <div className={`table-row${isFresh ? " is-fresh-capture" : ""}`} role="row" key={item.id}>
                  <span role="cell" data-label="Oportunidade">
                    <strong>{item.titulo}</strong>
                    <small>#{item.bitrix_deal_id}</small>
                  </span>
                  <span role="cell" data-label="Roleta">{item.roleta}</span>
                  <span role="cell" data-label="Captada em">{formatDate(item.captada_em)}</span>
                  <span role="cell" data-label="Valor">{formatCurrency(item.valor)}</span>
                  <span role="cell" data-label="Status">
                    <StatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusBadge>
                  </span>
                  <span role="cell" data-label="Bitrix">
                    {link ? (
                      <a
                        className="table-link"
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir ${item.titulo} no Bitrix24`}
                      >
                        Abrir
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    ) : (
                      <span className="table-muted">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Clock3 size={24} aria-hidden />
            <h3>
              {showAllCapturas || !selectedRoleta
                ? "Nenhuma captura recente"
                : "Nenhuma captura nesta roleta"}
            </h3>
            <p>
              {showAllCapturas || !selectedRoleta
                ? "As oportunidades que você captar aparecerão aqui com os dados sincronizados do Bitrix24."
                : "Selecione outra roleta ou capture uma nova oportunidade."}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
