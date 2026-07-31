"use client";

import type { ResultadoTopCorretor } from "@/lib/types/resultados";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ResultsTopCorretores({ brokers }: { brokers: ResultadoTopCorretor[] }) {
  if (!brokers.length) {
    return <p className="empty-copy">Nenhuma captação da Minha carteira neste recorte.</p>;
  }

  return (
    <ol className="results-top-brokers">
      {brokers.map((broker, index) => (
        <li key={broker.corretorId} className="results-top-broker">
          <span className="results-top-rank" aria-hidden>{index + 1}</span>
          <span className="export-broker-avatar">
            {broker.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={broker.fotoUrl} alt="" />
            ) : (
              initials(broker.corretor)
            )}
          </span>
          <div className="results-top-copy">
            <strong>{broker.corretor}</strong>
            <span>{broker.equipe}</span>
          </div>
          <div className="results-top-total" aria-label={`${broker.total} captações`}>
            <strong>{broker.total.toLocaleString("pt-BR")}</strong>
            <span>capturas</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
