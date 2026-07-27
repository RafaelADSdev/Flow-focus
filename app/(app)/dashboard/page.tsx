import { Suspense } from "react";
import { Activity, Building2, Inbox, TrendingDown } from "lucide-react";
import { DashboardFiltersPanel } from "@/components/dashboard-filters-panel";
import { LeadsBarChart } from "@/components/leads-bar-chart";
import { LeadsEvolutionChart } from "@/components/leads-evolution-chart";
import { LeadsFunnelChart } from "@/components/leads-funnel-chart";
import { LeadsRoletaChart } from "@/components/leads-roleta-chart";
import { PageHeader } from "@/components/page-header";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { getDashboardData, getDashboardFilterOptions } from "@/lib/data/dashboard";

export const metadata = { title: "Visão geral" };

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filters = parseDashboardFilters(params);
  const [dashboard, filterOptions] = await Promise.all([
    getDashboardData(filters),
    getDashboardFilterOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Visão geral comercial"
        description="Leads da Focus por data de entrada no corretor. Ajuste o período e recorte por equipe, corretor ou roleta."
        action={(
          <Suspense fallback={(
            <div className="overview-period-filter-wrap">
              <span className="button button-quiet overview-filters-trigger overview-period-filter-fallback">
                Filtros
              </span>
            </div>
          )}
          >
            <DashboardFiltersPanel filters={filters} options={filterOptions} />
          </Suspense>
        )}
      />

      <section className="overview-kpi-grid" aria-label="Resumo de leads">
        <article className="overview-kpi-card">
          <span className="overview-kpi-icon" aria-hidden="true"><Inbox size={18} /></span>
          <small>Leads recebidos</small>
          <strong>{dashboard.recebidos.toLocaleString("pt-BR")}</strong>
        </article>

        <article className="overview-kpi-card overview-kpi-danger">
          <span className="overview-kpi-icon" aria-hidden="true"><TrendingDown size={18} /></span>
          <small>Leads perdidos</small>
          <strong>{dashboard.perdidos.toLocaleString("pt-BR")}</strong>
          <em>· {dashboard.percentual_perdidos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do volume</em>
        </article>

        <article className="overview-kpi-card overview-kpi-warning">
          <span className="overview-kpi-icon" aria-hidden="true"><Activity size={18} /></span>
          <small>Leads ativos</small>
          <strong>{dashboard.ativos.toLocaleString("pt-BR")}</strong>
          <em>· Recebidos − perdidos</em>
        </article>

        <article className="overview-kpi-card overview-kpi-success">
          <span className="overview-kpi-icon" aria-hidden="true"><Building2 size={18} /></span>
          <small>Corretores ativos roleta</small>
          <strong>{dashboard.corretores_ativos_roleta.toLocaleString("pt-BR")}</strong>
        </article>
      </section>

      <section className="overview-charts-grid">
        <article className="overview-chart-panel">
          <div className="section-heading">
            <div>
              <h2>Leads por equipe</h2>
              <p>Volume do Comercial Geral por equipe no período.</p>
            </div>
          </div>
          <LeadsBarChart data={dashboard.por_equipe} ariaLabel="Leads por equipe no período" />
        </article>

        <article className="overview-chart-panel">
          <div className="section-heading">
            <div>
              <h2>Evolução no período</h2>
              <p>Comparativo diário do Comercial Geral entre recebidos e perdidos.</p>
            </div>
            <div className="chart-legend">
              <span><i className="legend-primary" />Recebidos</span>
              <span><i className="legend-danger" />Perdidos</span>
            </div>
          </div>
          <LeadsEvolutionChart data={dashboard.serie} />
        </article>

        <article className="overview-chart-panel">
          <div className="section-heading">
            <div>
              <h2>Funil — Comercial Geral</h2>
              <p>
                {dashboard.gargalo_label
                  ? (
                    <span className="funnel-bottleneck">
                      Gargalo: {dashboard.gargalo_label} · {dashboard.gargalo_total.toLocaleString("pt-BR")} leads ({dashboard.gargalo_percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
                    </span>
                  )
                  : "Leads que entraram no período, agrupados pelo estágio atual no Comercial Geral."}
              </p>
            </div>
          </div>
          <LeadsFunnelChart data={dashboard.funil} ariaLabel="Funil Comercial Geral por estágio" />
        </article>

        <article className="overview-chart-panel">
          <div className="section-heading">
            <div>
              <h2>Leads por roleta</h2>
              <p>Volume por Roleta Atual no período — passe o mouse para ver ativos e perdidos.</p>
            </div>
          </div>
          <p className="overview-panel-kicker">Roletas com mais leads</p>
          <LeadsRoletaChart data={dashboard.por_roleta} />
        </article>
      </section>
    </>
  );
}
