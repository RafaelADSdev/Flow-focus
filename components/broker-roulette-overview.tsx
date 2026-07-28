import { Clock3, TriangleAlert, UserRound } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard";

type BrokerSummary = DashboardData["corretores"][number];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function activityLabel(value: string | null) {
  if (!value) return "Sem atividade no período";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "Atividade sem data";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return "Atividade hoje";
  if (days === 1) return "Atividade há 1 dia";
  return `Atividade há ${days} dias`;
}

const statusLabels: Record<BrokerSummary["status"], string> = {
  liberado: "Liberado",
  auditoria: "Auditoria",
  bloqueado: "Bloqueado",
};

function BrokerAvatar({ broker }: { broker: BrokerSummary }) {
  if (broker.foto_url) {
    return (
      <span
        className="broker-health-avatar has-photo"
        role="img"
        aria-label={`Foto de ${broker.nome}`}
        style={{ backgroundImage: `url(${JSON.stringify(broker.foto_url).slice(1, -1)})` }}
      />
    );
  }

  return (
    <span className="broker-health-avatar" aria-hidden="true">
      {initials(broker.nome) || <UserRound size={17} />}
    </span>
  );
}

export function BrokerRouletteOverview({ data }: { data: BrokerSummary[] }) {
  if (!data.length) {
    return (
      <div className="broker-health-empty">
        <UserRound size={22} aria-hidden="true" />
        <p>Nenhum corretor com volume neste recorte.</p>
      </div>
    );
  }

  return (
    <div className="broker-health-table" role="table" aria-label="Situação das roletas por corretor">
      <div className="broker-health-head" role="row">
        <span role="columnheader">Corretor</span>
        <span role="columnheader">Ciclo</span>
        <span role="columnheader">Roletas no período</span>
        <span role="columnheader">Ativos</span>
        <span role="columnheader">Perdidos</span>
        <span role="columnheader">Críticos</span>
        <span role="columnheader">Última atividade</span>
      </div>
      {data.map((broker) => (
        <div className="broker-health-row" role="row" key={broker.id}>
          <span className="broker-health-person" role="cell" data-label="Corretor">
            <BrokerAvatar broker={broker} />
            <span>
              <strong>{broker.nome}</strong>
              <small>{broker.equipe}</small>
            </span>
          </span>
          <span role="cell" data-label="Ciclo">
            <span className={`broker-health-status is-${broker.status}`}>
              {statusLabels[broker.status]}
            </span>
          </span>
          <span className="broker-health-roulettes" role="cell" data-label="Roletas no período">
            {broker.roletas.length
              ? broker.roletas.slice(0, 2).map((roleta) => <em key={roleta}>{roleta}</em>)
              : <small>Sem volume</small>}
            {broker.roletas.length > 2 ? <small>+{broker.roletas.length - 2}</small> : null}
          </span>
          <strong className="broker-health-number" role="cell" data-label="Ativos">{broker.ativos}</strong>
          <strong className="broker-health-number" role="cell" data-label="Perdidos">{broker.perdidos}</strong>
          <span role="cell" data-label="Críticos">
            {broker.criticos > 0 ? (
              <span className="broker-health-critical">
                <TriangleAlert size={14} aria-hidden="true" />
                {broker.criticos}
              </span>
            ) : <span className="broker-health-ok">Em dia</span>}
          </span>
          <span className="broker-health-activity" role="cell" data-label="Última atividade">
            <Clock3 size={13} aria-hidden="true" />
            {activityLabel(broker.ultima_atividade)}
          </span>
        </div>
      ))}
    </div>
  );
}
