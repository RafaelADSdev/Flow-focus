"use client";

import { LeadsBarChart } from "@/components/leads-bar-chart";
import type { ResultadoCapturaEquipe, ResultadoTopCorretor } from "@/lib/types/resultados";

export function ResultsCapturaCharts({
  capturasPorEquipe,
  topCorretores,
  totalCapturados,
}: {
  capturasPorEquipe: ResultadoCapturaEquipe[];
  topCorretores: ResultadoTopCorretor[];
  totalCapturados: number;
}) {
  const resumo = totalCapturados.toLocaleString("pt-BR");

  return (
    <section className="overview-charts-grid results-charts-grid" aria-label="Capturas do bolsão">
      <article className="overview-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Capturas do bolsão por equipe</h2>
            <p>Distribuição dos {resumo} leads captados pelo Flow Focus.</p>
          </div>
        </div>
        <LeadsBarChart
          data={capturasPorEquipe.map((item) => ({ nome: item.equipe, total: item.total }))}
          ariaLabel="Capturas do bolsão por equipe"
          valueLabel="Capturas"
        />
      </article>

      <article className="overview-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Top 5 corretores</h2>
            <p>Corretores com mais captações entre os {resumo} leads do Flow Focus.</p>
          </div>
        </div>
        <LeadsBarChart
          data={topCorretores.map((item) => ({ nome: item.corretor, total: item.total }))}
          ariaLabel="Top 5 corretores em capturas do bolsão"
          valueLabel="Capturas"
        />
      </article>
    </section>
  );
}
