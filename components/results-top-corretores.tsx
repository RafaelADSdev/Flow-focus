"use client";

import type { ResultadoTopCorretor } from "@/lib/types/resultados";
import { UserAvatar } from "@/components/user-avatar";

export function ResultsTopCorretores({ brokers }: { brokers: ResultadoTopCorretor[] }) {
  if (!brokers.length) {
    return <p className="empty-copy">Nenhuma captação da Minha carteira neste recorte.</p>;
  }

  return (
    <ol className="results-top-brokers">
      {brokers.map((broker, index) => (
        <li key={broker.corretorId} className="results-top-broker">
          <span className="results-top-rank" aria-hidden>{index + 1}</span>
          <UserAvatar name={broker.corretor} photoUrl={broker.fotoUrl} className="export-broker-avatar" />
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
