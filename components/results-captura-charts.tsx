"use client";

import { LeadsBarChart } from "@/components/leads-bar-chart";
import { ResultsTopCorretores } from "@/components/results-top-corretores";
import { RESULTADOS_EQUIPE_CHART_SERIES_RESOLVED } from "@/lib/chart-palette";
import type { ResultadoCapturaEquipe, ResultadoTopCorretor } from "@/lib/types/resultados";

export function ResultsCapturaCharts({
  capturasPorEquipe,
  topCorretores,
  totalCapturados,
  totalAndamento,
  totalPerdidos,
  totalQuarentena,
}: {
  capturasPorEquipe: ResultadoCapturaEquipe[];
  topCorretores: ResultadoTopCorretor[];
  totalCapturados: number;
  totalAndamento: number;
  totalPerdidos: number;
  totalQuarentena: number;
}) {
  const resumoCapturas = totalCapturados.toLocaleString("pt-BR");
  const resumoAndamento = totalAndamento.toLocaleString("pt-BR");
  const resumoPerdidos = totalPerdidos.toLocaleString("pt-BR");
  const resumoQuarentena = totalQuarentena.toLocaleString("pt-BR");

  return (
    <section className="overview-charts-grid results-charts-grid" aria-label="Leads por equipe">
      <article className="overview-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Top 5 corretores</h2>
            <p>Corretores que mais puxaram leads do bolsão pela Minha carteira.</p>
          </div>
        </div>
        <ResultsTopCorretores brokers={topCorretores} />
      </article>

      <article className="overview-chart-panel results-team-chart-panel">
        <div className="section-heading results-team-chart-heading">
          <div className="results-team-chart-intro">
            <h2>Leads captados por equipe</h2>
            <p className="results-chart-summary">
              {resumoCapturas} captados · {resumoAndamento} em andamento · {resumoPerdidos} perdidos · {resumoQuarentena} em quarentena
            </p>
            <div className="chart-legend results-chart-legend">
              <span><i className="legend-captados" />Captados</span>
              <span><i className="legend-andamento" />Andamento</span>
              <span><i className="legend-perdidos" />Perdidos</span>
              <span><i className="legend-quarentena" />Quarentena</span>
            </div>
          </div>
        </div>
        <div className="results-team-chart-body">
          <LeadsBarChart
            data={capturasPorEquipe.map((item) => ({
              nome: item.equipe,
              total: item.total,
              andamento: item.andamento,
              perdidos: item.perdidos,
              quarentena: item.quarentena,
            }))}
            ariaLabel="Leads captados, em andamento, negócios perdidos e quarentena por equipe"
            series={[...RESULTADOS_EQUIPE_CHART_SERIES_RESOLVED]}
            orientation="vertical"
            keepEmptyCategories
            fillContainer
            hideLegend
          />
        </div>
      </article>
    </section>
  );
}
