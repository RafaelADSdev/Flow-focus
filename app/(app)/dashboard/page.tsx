import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutPanelTop } from "lucide-react";
import { BrokerRouletteOverview } from "@/components/broker-roulette-overview";
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

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const filters = parseDashboardFilters(params);
  const [dashboard, filterOptions] = await Promise.all([
    getDashboardData(filters),
    getDashboardFilterOptions(),
  ]);

  const hasVolume = dashboard.recebidos > 0 || dashboard.perdidos > 0 || dashboard.funil.some((item) => item.total > 0);
  const decisionTitle = dashboard.gargalo_label
    ? dashboard.gargalo_label
    : hasVolume
      ? "Esteira sem gargalo destacado"
      : "Nenhum lead no recorte";
  const decisionCopy = dashboard.gargalo_label
    ? `${dashboard.gargalo_total.toLocaleString("pt-BR")} leads neste estágio (${dashboard.gargalo_percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do funil). Abra Equipe para agir.`
    : hasVolume
      ? "O funil está equilibrado no período. Use os gráficos abaixo para comparar equipes e roletas."
      : "Ajuste período, equipe e roleta nos filtros ou aguarde a próxima sincronização.";

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Estado do ciclo comercial Focus no período. O gargalo aponta o próximo passo — o Bitrix24 continua sendo o CRM."
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

      <section className="overview-decision" aria-label="Próximo foco operacional">
        <div className="overview-decision-copy">
          <p className="overview-decision-label">
            {dashboard.gargalo_label ? "Gargalo atual" : "Foco operacional"}
          </p>
          <h2>{decisionTitle}</h2>
          <p>{decisionCopy}</p>
          <p className="overview-decision-fresh">Atualizado às {formatGeneratedAt(dashboard.gerado_em)}</p>
        </div>
        <div className="overview-decision-actions">
          <Link className="button overview-decision-btn overview-decision-btn-primary" href="/equipe">
            Abrir Equipe
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link className="button overview-decision-btn overview-decision-btn-secondary" href="/auditorias">
            Auditorias
          </Link>
          <Link className="button overview-decision-btn overview-decision-btn-tertiary" href="/roletas">
            Roletas
          </Link>
        </div>
      </section>

      <section className="kpi-strip overview-metrics" aria-label="Resumo do ciclo">
        <div>
          <span>
            <small>Recebidos</small>
            <strong>{dashboard.recebidos.toLocaleString("pt-BR")}</strong>
          </span>
        </div>
        <div>
          <span>
            <small>Perdidos</small>
            <strong>{dashboard.perdidos.toLocaleString("pt-BR")}</strong>
            <em>{dashboard.percentual_perdidos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do volume</em>
          </span>
        </div>
        <div>
          <span>
            <small>Ativos</small>
            <strong>{dashboard.ativos.toLocaleString("pt-BR")}</strong>
            <em>Recebidos menos perdidos</em>
          </span>
        </div>
        <div>
          <span>
            <small>Leads críticos</small>
            <strong>{dashboard.leads_criticos.toLocaleString("pt-BR")}</strong>
            <em>Sem atualização há 3+ dias</em>
          </span>
        </div>
      </section>

      {!hasVolume ? (
        <section className="empty-state">
          <LayoutPanelTop size={28} aria-hidden="true" />
          <h2>Nenhum lead neste recorte</h2>
          <p>
            Não há volume para o período e filtros atuais. Ajuste o recorte ou aguarde a próxima sincronização.
          </p>
          <Link className="button button-secondary" href="/equipe">
            Ir à Equipe
          </Link>
        </section>
      ) : (
        <>
          <section className="overview-broker-health" aria-labelledby="overview-broker-health-title">
            <div className="section-heading">
              <div>
                <h2 id="overview-broker-health-title">Roleta dos corretores</h2>
                <p>
                  {dashboard.corretores_ativos_roleta.toLocaleString("pt-BR")} corretores no recorte. Ciclo, críticos, foto e campanhas — filtre por roleta no topo.
                </p>
              </div>
              <Link className="button button-quiet" href="/roletas">
                Ajustar campanhas visíveis
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <BrokerRouletteOverview data={dashboard.corretores} />
          </section>

          <section className="overview-chart-primary" aria-labelledby="overview-funnel-title">
            <div className="section-heading">
              <div>
                <h2 id="overview-funnel-title">Funil — Comercial Geral</h2>
                <p>
                  {dashboard.gargalo_label
                    ? `Gargalo em ${dashboard.gargalo_label}. Leads do período pelo estágio atual.`
                    : "Leads que entraram no período, agrupados pelo estágio atual no Comercial Geral."}
                </p>
              </div>
              <Link className="button button-quiet" href="/equipe">
                Ver equipe
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <LeadsFunnelChart data={dashboard.funil} ariaLabel="Funil Comercial Geral por estágio" />
          </section>

          <section className="overview-charts-grid" aria-label="Detalhamento do período">
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
                  <p>Comparativo diário entre recebidos e perdidos.</p>
                </div>
                <div className="chart-legend">
                  <span><i className="legend-primary" />Recebidos</span>
                  <span><i className="legend-danger" />Perdidos</span>
                </div>
              </div>
              <LeadsEvolutionChart data={dashboard.serie} />
            </article>

            <article className="overview-chart-panel overview-chart-panel-wide">
              <div className="section-heading">
                <div>
                  <h2>Leads por roleta</h2>
                  <p>Volume por Roleta Atual no período, com ativos e perdidos.</p>
                </div>
                <Link className="button button-quiet" href="/roletas">
                  Configurar roletas
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
              <LeadsRoletaChart data={dashboard.por_roleta} />
            </article>
          </section>
        </>
      )}
    </>
  );
}
