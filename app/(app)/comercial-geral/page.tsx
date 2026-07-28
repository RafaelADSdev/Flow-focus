import { Suspense } from "react";
import { LayoutPanelTop } from "lucide-react";
import { ComercialKanbanBoard } from "@/components/comercial-kanban-board";
import { ComercialKanbanSync } from "@/components/comercial-kanban-sync";
import { DashboardFiltersPanel } from "@/components/dashboard-filters-panel";
import { PageHeader } from "@/components/page-header";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { getComercialKanbanData } from "@/lib/data/comercial-kanban";

export const metadata = { title: "Comercial Geral" };

type ComercialGeralPageProps = { searchParams: Promise<Record<string, string | undefined>> };

function daysSince(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

export default async function ComercialGeralPage({ searchParams }: ComercialGeralPageProps) {
  const filters = parseDashboardFilters(await searchParams);
  const data = await getComercialKanbanData(filters);
  const boardKey = [filters.de, filters.ate, filters.diretoria, filters.equipe, filters.corretor, filters.roleta, data.generatedAt].join(":");
  const staleCount = data.stages.reduce(
    (total, stage) => total + stage.cards.filter((card) => daysSince(card.updatedAt) >= 3).length,
    0,
  );

  return (
    <>
      <div className="kanban-page">
      <PageHeader
        title="Comercial Geral"
        description="Acompanhe a posição atual dos negócios Focus e mova fases no Bitrix24. A captação acontece somente pela Minha carteira."
        action={(
          <div className="page-header-action-group">
            <ComercialKanbanSync initialSyncedAt={data.generatedAt} />
            <Suspense fallback={<span className="button button-quiet">Filtros</span>}>
              <DashboardFiltersPanel filters={filters} options={data.filterOptions} basePath="/comercial-geral" />
            </Suspense>
          </div>
        )}
      />

      <section className="kanban-summary" aria-label="Resumo do Comercial Geral">
        <div>
          <span className="kanban-summary-icon"><LayoutPanelTop size={18} aria-hidden="true" /></span>
          <div className="kanban-summary-metrics">
            <p><strong>{data.total.toLocaleString("pt-BR")}</strong> negócios no período</p>
            {staleCount > 0 ? (
              <p className="kanban-summary-stale">
                <strong>{staleCount.toLocaleString("pt-BR")}</strong>
                {staleCount === 1 ? " parado há 3+ dias" : " parados há 3+ dias"}
              </p>
            ) : (
              <p>Filas sem envelhecimento crítico no recorte.</p>
            )}
          </div>
        </div>
        {data.canMove ? (
          <p className="kanban-summary-hint">Arraste pelo ícone ou abra o card para mover a fase no Bitrix24.</p>
        ) : (
          <p className="kanban-summary-hint">Visualização da esteira. Abra o card para consultar o negócio no Bitrix24.</p>
        )}
      </section>

      {data.stages.length ? (
        <ComercialKanbanBoard key={boardKey} initialStages={data.stages} canMove={data.canMove} brokers={data.brokers} />
      ) : (
        <section className="empty-state">
          <LayoutPanelTop size={28} aria-hidden="true" />
          <h2>Nenhum negócio neste recorte</h2>
          <p>
            Não há estágios ou negócios para os filtros atuais. Sincronize com o Bitrix24 ou ajuste o período, a equipe e a roleta no topo da página.
          </p>
        </section>
      )}
      </div>
    </>
  );
}
