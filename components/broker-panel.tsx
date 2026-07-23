"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Clock3, LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import { captarOportunidade } from "@/lib/actions/captura";
import type { CarteiraData } from "@/lib/types/carteira";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

const roletaTones = ["violet", "teal", "amber"] as const;

const statusLabels: Record<CarteiraData["capturas_recentes"][number]["status"], string> = {
  disponivel: "Disponível",
  captada: "Captada",
  em_trabalho: "Em contato",
  convertida: "Convertida",
  perdida: "Perdida",
};

const statusTones: Record<CarteiraData["capturas_recentes"][number]["status"], "success" | "warning" | "danger" | "neutral" | "info"> = {
  disponivel: "neutral",
  captada: "info",
  em_trabalho: "success",
  convertida: "success",
  perdida: "danger",
};

const cycleLabels: Record<CarteiraData["estado_ciclo"], string> = {
  captacao_liberada: "Captação liberada",
  auditoria_pendente: "Auditoria pendente",
  bloqueado: "Captação bloqueada",
};

export function BrokerPanel({ data }: { data: CarteiraData }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { capturados, limite, estado_ciclo: estadoCiclo, roletas, capturas_recentes: capturasRecentes } = data;
  const restante = Math.max(0, limite - capturados);
  const limiteAtingido = capturados >= limite || estadoCiclo !== "captacao_liberada";
  const progress = limite > 0 ? Math.min(100, (capturados / limite) * 100) : 0;

  async function capture(id: string) {
    setLoadingId(id);
    setMessage("");
    setError("");

    const result = await captarOportunidade({ roletaId: id });

    setLoadingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Oportunidade captada e vinculada a sua carteira no Bitrix24.");
    router.refresh();
  }

  return (
    <>
      <section className="broker-overview">
        <div className="limit-copy">
          <span className="limit-label">Seu limite de hoje</span>
          <div><strong>{capturados}</strong><span>de {limite} oportunidades</span></div>
          <p>
            {estadoCiclo === "bloqueado"
              ? "Captação bloqueada. Aguarde a liberação da liderança."
              : restante > 0
                ? `Você ainda pode captar ${restante} oportunidade${restante === 1 ? "" : "s"}.`
                : "Lote completo. Trabalhe a carteira e aguarde a auditoria."}
          </p>
        </div>
        <div className="progress-block" aria-label={`${capturados} de ${limite} oportunidades captadas`}>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="progress-scale"><span>Início</span><span>Limite diário</span></div>
        </div>
        <div className="cycle-state">
          <span className="state-icon"><Clock3 size={20} /></span>
          <span><small>Estado do ciclo</small><strong>{cycleLabels[estadoCiclo]}</strong></span>
        </div>
      </section>

      {message ? <div className="success-banner" role="status"><Check size={18} />{message}<button type="button" onClick={() => setMessage("")} aria-label="Fechar aviso">×</button></div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Roletas disponíveis</h2>
            <p>As oportunidades são atribuídas automaticamente ao captar.</p>
          </div>
          <span className="sync-label"><RefreshCw size={14} />Sincronizado {formatDate(data.gerado_em)}</span>
        </div>

        {roletas.length ? (
          <div className="roulette-list">
            {roletas.map((roulette, index) => (
              <article className="roulette-row" key={roulette.id}>
                <span className={`roulette-signal signal-${roletaTones[index % roletaTones.length]}`}><Sparkles size={18} /></span>
                <div className="roulette-copy"><h3>{roulette.nome}</h3><p>{roulette.descricao || "Sem descrição cadastrada."}</p></div>
                <div className="available-count"><strong>{roulette.disponiveis}</strong><span>disponíveis</span></div>
                <button
                  className="button button-secondary"
                  disabled={limiteAtingido || loadingId !== null || roulette.disponiveis === 0}
                  onClick={() => capture(roulette.id)}
                >
                  {loadingId === roulette.id ? <><RefreshCw size={16} className="spin" />Captando</> : limiteAtingido ? <><LockKeyhole size={16} />Limite atingido</> : roulette.disponiveis === 0 ? <>Sem oportunidades</> : <>Captar oportunidade<ArrowUpRight size={16} /></>}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Sparkles size={24} />
            <h2>Nenhuma roleta liberada</h2>
            <p>Quando a liderança liberar roletas para você, elas aparecerão aqui com a contagem vinda do banco.</p>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Capturas recentes</h2>
            <p>Continue o atendimento e os registros diretamente no Bitrix24.</p>
          </div>
          <button type="button" className="text-button" disabled={!capturasRecentes.length}>Ver histórico completo</button>
        </div>

        {capturasRecentes.length ? (
          <div className="data-table">
            <div className="table-head"><span>Oportunidade</span><span>Roleta</span><span>Captada em</span><span>Valor estimado</span><span>Status</span></div>
            {capturasRecentes.map((item) => (
              <div className="table-row" key={item.id}>
                <span data-label="Oportunidade"><strong>{item.titulo}</strong><small>#{item.bitrix_deal_id}</small></span>
                <span data-label="Roleta">{item.roleta}</span>
                <span data-label="Captada em">{formatDate(item.captada_em)}</span>
                <span data-label="Valor">{formatCurrency(item.valor)}</span>
                <span data-label="Status"><StatusBadge tone={statusTones[item.status]}>{statusLabels[item.status]}</StatusBadge></span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Clock3 size={24} />
            <h2>Nenhuma captura recente</h2>
            <p>As oportunidades que você captar aparecerão aqui com os dados sincronizados do Bitrix24.</p>
          </div>
        )}
      </section>
    </>
  );
}
