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

const captureAvailabilityMeta: Record<
  CarteiraData["disponibilidade_captura"],
  { title: string; description: string; icon: typeof Inbox }
> = {
  disponivel: {
    title: "Captação disponível",
    description: "Sua próxima oportunidade disponível será atribuída a você.",
    icon: Inbox,
  },
  perfil_sem_captura: {
    title: "Carteira em modo de consulta",
    description: "Seu perfil acompanha esta carteira, mas não pode captar oportunidades.",
    icon: LockKeyhole,
  },
  sem_permissao_roleta: {
    title: "Sem acesso a uma roleta de captação",
    description: "Peça à liderança para revisar suas permissões de roleta.",
    icon: LockKeyhole,
  },
  sem_roleta_ativa: {
    title: "Roleta de captação indisponível",
    description: "Suas permissões não apontam para uma roleta ativa de captação. Peça à liderança para revisar a configuração.",
    icon: LockKeyhole,
  },
  sem_oportunidades: {
    title: "Fila sem oportunidades",
    description: "Não há oportunidades nas suas roletas agora. Sincronize os leads ou tente novamente mais tarde.",
    icon: Inbox,
  },
  dados_indisponiveis: {
    title: "Não foi possível confirmar sua disponibilidade",
    description: "Atualize a carteira para tentar novamente. Se o problema continuar, fale com a liderança.",
    icon: RefreshCw,
  },
};

function dealUrl(portalBase: string, dealId: string) {
  const id = dealId.trim();
  if (!portalBase || !id) return null;
  return `${portalBase}/crm/deal/details/${encodeURIComponent(id)}/`;
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
      title: "Existe uma auditoria pendente. A liderança libera uma nova vaga após a aprovação.",
      icon: <Clock3 size={16} aria-hidden />,
    };
  }
  if (capturados >= limite) {
    return {
      label: "Limite atingido",
      title: `Capacidade de ${limite} leads ativos atingida. Aguarde a auditoria.`,
      icon: <LockKeyhole size={16} aria-hidden />,
    };
  }
  return null;
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
  const captureEligibilityId = useId();
  const [capturing, setCapturing] = useState(false);
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
  const syncingRef = useRef(false);
  const prevCapturadosRef = useRef(data.capturados);
  const prevEstadoRef = useRef(data.estado_ciclo);

  const {
    capturados,
    limite,
    estado_ciclo: estadoCiclo,
    disponibilidade_captura: disponibilidadeCaptura,
    roletas,
    capturas_recentes: capturasRecentes,
  } = data;
  const totalDisponiveis = roletas.reduce((sum, item) => sum + item.disponiveis, 0);
  const temDisponiveis = totalDisponiveis > 0;
  const restante = Math.max(0, limite - capturados);
  const cicloLiberado = estadoCiclo === "captacao_liberada";
  const limiteAtivoAtingido = capturados >= limite;
  const disponibilidade = captureAvailabilityMeta[disponibilidadeCaptura];
  const capturaIndisponivel = disponibilidadeCaptura !== "disponivel";
  const captacaoTravada = !cicloLiberado || limiteAtivoAtingido || capturaIndisponivel;
  const gate = captureGateLabel(estadoCiclo, capturados, limite);
  const progress = limite > 0 ? Math.min(100, (capturados / limite) * 100) : 0;
  const CycleIcon = cycleMeta[estadoCiclo].icon;
  const limitHint =
    estadoCiclo === "bloqueado"
      ? "Captação bloqueada. Aguarde a liberação da liderança."
      : estadoCiclo === "auditoria_pendente"
        ? "A auditoria da liderança precisa ser concluída antes de uma nova captura."
        : restante > 0
          ? `Você ainda pode captar ${restante} oportunidade${restante === 1 ? "" : "s"}.`
          : "Capacidade completa. Cada lead aprovado pela liderança libera uma nova vaga.";
  const captureEligibility = gate?.title ?? disponibilidade.description;
  const captureHeadingCopy = disponibilidadeCaptura === "disponivel" && temDisponiveis
    ? `${totalDisponiveis} oportunidade${totalDisponiveis === 1 ? "" : "s"} na fila. A próxima disponível será atribuída a você.`
    : disponibilidade.description;
  const AvailabilityIcon = disponibilidade.icon;

  const isPageBusy = syncing || capturing || isRefreshing;
  const displayedSyncedAt = Date.parse(lastSyncedAt) >= Date.parse(data.gerado_em) ? lastSyncedAt : data.gerado_em;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setProgressReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    const timer = window.setInterval(() => {
      void syncLeads("auto");
    }, AUTO_SYNC_MS);

    return () => window.clearInterval(timer);
  }, [syncLeads]);

  async function capture() {
    if (capturing) return;
    setCapturing(true);
    setMessage("");
    setMessageLink(null);
    setError("");

    try {
      const result = await captarOportunidade();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const link = dealUrl(bitrixPortalBase, result.bitrixDealId);
      setMessage(
        result.titulo
          ? `“${result.titulo}” captada${result.roleta ? ` da roleta ${result.roleta}` : ""}. Continue o atendimento no Bitrix24.`
          : "Oportunidade captada. Continue o atendimento no Bitrix24.",
      );
      setMessageLink(link);
      if (result.bitrixDealId) setHighlightDealId(result.bitrixDealId);
      refreshData();
    } catch {
      setError("Não foi possível concluir a captação. Atualize a carteira e tente novamente.");
    } finally {
      setCapturing(false);
    }
  }

  function renderCaptureLabel(): ReactNode {
    if (capturing) {
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
    if (disponibilidadeCaptura === "sem_oportunidades") {
      return (
        <>
          <Inbox size={16} aria-hidden />
          Fila vazia
        </>
      );
    }
    if (disponibilidadeCaptura === "dados_indisponiveis") {
      return (
        <>
          <RefreshCw size={16} aria-hidden />
          Indisponível agora
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

  return (
    <>
      {isPageBusy ? (
        <div className="page-busy-bar" role="status" aria-live="polite">
          <RefreshCw size={14} className="is-spinning" aria-hidden="true" />
          <span>
            {capturing ? "Captando oportunidade…" : syncing ? "Sincronizando leads…" : "Atualizando carteira…"}
          </span>
        </div>
      ) : null}

      <section className="broker-overview" aria-label="Capacidade de leads ativos e estado do ciclo">
        <div className="limit-copy">
          <span className="limit-label">Leads ativos</span>
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
            <span>Teto de {limite}</span>
          </div>
        </div>
        <div
          id={cycleStatusId}
          className={`cycle-state cycle-state--${cycleMeta[estadoCiclo].tone}${cyclePulse ? " is-cycle-shift" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
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

      <section className="section-block" aria-labelledby="broker-captura-heading">
        <div className="section-heading">
          <div>
            <h2 id="broker-captura-heading">Captar oportunidade</h2>
            <p>{captureHeadingCopy}</p>
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
              {syncing ? "Atualizando fila do Bitrix24" : `Última sync ${formatDate(displayedSyncedAt)}`}
            </span>
          </div>
        </div>

        <div className={`broker-capture-panel${capturing ? " is-claiming" : ""}${capturaIndisponivel ? " is-unavailable" : ""}`}>
          <div className="broker-capture-action">
            {roletas.length && disponibilidadeCaptura !== "perfil_sem_captura" ? (
            <button
              type="button"
              className={`button ${
                cicloLiberado &&
                !limiteAtivoAtingido &&
                temDisponiveis &&
                !capturing &&
                !syncing &&
                !isRefreshing
                  ? "button-primary"
                  : "button-secondary"
              }`}
              disabled={captacaoTravada || capturing || syncing || isRefreshing || !temDisponiveis}
              aria-describedby={gate ? `${cycleStatusId} ${captureEligibilityId}` : captureEligibilityId}
              onClick={() => void capture()}
            >
              {renderCaptureLabel()}
            </button>
            ) : (
              <div className="broker-capture-unavailable">
                <AvailabilityIcon size={20} aria-hidden />
                <strong>{disponibilidade.title}</strong>
              </div>
            )}
            <p
              id={captureEligibilityId}
              className="broker-capture-hint"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {captureEligibility}
            </p>
          </div>
          {disponibilidadeCaptura === "dados_indisponiveis" ? (
            <button
              type="button"
              className="button button-quiet broker-capture-retry"
              disabled={isPageBusy}
              onClick={refreshData}
            >
              <RefreshCw size={15} aria-hidden />
              Atualizar carteira
            </button>
          ) : null}
        </div>
      </section>

      <section className="section-block" aria-labelledby="broker-capturas-heading">
        <div className="section-heading">
          <div>
            <h2 id="broker-capturas-heading">Capturas recentes</h2>
            <p>Continue o atendimento e os registros diretamente no Bitrix24.</p>
          </div>
        </div>

        {capturasRecentes.length ? (
          <div className="data-table broker-capturas-table" role="table" aria-label="Capturas recentes">
            <div className="table-head" role="row">
              <span role="columnheader">Oportunidade</span>
              <span role="columnheader">Roleta de origem</span>
              <span role="columnheader">Captada em</span>
              <span role="columnheader">Valor estimado</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Bitrix</span>
            </div>
            {capturasRecentes.map((item) => {
              const link = dealUrl(bitrixPortalBase, item.bitrix_deal_id);
              const isFresh = highlightDealId !== null && item.bitrix_deal_id === highlightDealId;
              return (
                <div className={`table-row${isFresh ? " is-fresh-capture" : ""}`} role="row" key={item.id}>
                  <span role="cell" data-label="Oportunidade">
                    <strong>{item.titulo}</strong>
                    <small>#{item.bitrix_deal_id}</small>
                  </span>
                  <span role="cell" data-label="Roleta de origem">{item.roleta}</span>
                  <span role="cell" data-label="Captada em">{formatDate(item.captada_em)}</span>
                  <span role="cell" data-label="Valor estimado">{formatCurrency(item.valor)}</span>
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
            <h3>Nenhuma captura recente</h3>
            <p>As oportunidades que você captar aparecerão aqui com os dados sincronizados do Bitrix24.</p>
          </div>
        )}
      </section>
    </>
  );
}
