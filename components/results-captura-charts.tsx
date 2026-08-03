"use client";

import { LeadsBarChart } from "@/components/leads-bar-chart";
import { ResultsTopCorretores } from "@/components/results-top-corretores";
import type { ResultadoCapturaEquipe, ResultadoTopCorretor } from "@/lib/types/resultados";

const EQUIPE_CHART_SERIES = [
  { key: "capturas", label: "Capturas", color: "#3C1048" },
  { key: "quarentena", label: "Em quarentena", color: "oklch(0.67 0.14 75)" },
] as const;

export function ResultsCapturaCharts({
  capturasPorEquipe,
  topCorretores,
  totalCapturados,
  totalQuarentena,
}: {
  capturasPorEquipe: ResultadoCapturaEquipe[];
  topCorretores: ResultadoTopCorretor[];
  totalCapturados: number;
  totalQuarentena: number;
}) {
  const resumoCapturas = totalCapturados.toLocaleString("pt-BR");
  const resumoQuarentena = totalQuarentena.toLocaleString("pt-BR");

  return (
    <section className="overview-charts-grid results-charts-grid" aria-label="Capturas da Minha carteira">
      <article className="overview-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Capturas do bolsão por equipe</h2>
            <p>
              {totalQuarentena > 0
                ? `${resumoCapturas} capturas pela Minha carteira e ${resumoQuarentena} em quarentena no Comercial Geral.`
                : `Distribuição dos ${resumoCapturas} leads puxados pela Minha carteira.`}
            </p>
          </div>
        </div>
        <LeadsBarChart
          data={capturasPorEquipe.map((item) => ({
            nome: item.equipe,
            capturas: item.total,
            quarentena: item.quarentena,
          }))}
          ariaLabel="Capturas e quarentena por equipe"
          series={[...EQUIPE_CHART_SERIES]}
        />
      </article>

      <article className="overview-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Top 5 corretores</h2>
            <p>Corretores que mais puxaram leads do bolsão pela Minha carteira.</p>
          </div>
        </div>
        <ResultsTopCorretores brokers={topCorretores} />
      </article>
    </section>
  );
}
