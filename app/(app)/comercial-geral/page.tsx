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

export default async function ComercialGeralPage({ searchParams }: ComercialGeralPageProps) {
  const filters = parseDashboardFilters(await searchParams);
  const data = await getComercialKanbanData(filters);
  const boardKey = [filters.de, filters.ate, filters.diretoria, filters.equipe, filters.corretor, filters.roleta, data.generatedAt].join(":");

  return (
    <>
      <PageHeader
        title="Comercial Geral"
        description="Acompanhe a posição atual dos negócios Focus e mova a fase diretamente no Bitrix24."
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
          <p><strong>{data.total.toLocaleString("pt-BR")}</strong> negócios no período</p>
        </div>
        <p>Arraste pelo ícone para alterar a fase. Abra o card para consultar o negócio no Bitrix24.</p>
      </section>

      {data.stages.length ? (
        <ComercialKanbanBoard key={boardKey} initialStages={data.stages} canMove={data.canMove} brokers={data.brokers} />
      ) : (
        <section className="empty-state">
          <LayoutPanelTop size={28} aria-hidden="true" />
          <h2>O quadro ainda não está disponível</h2>
          <p>Não encontramos estágios do Comercial Geral ou negócios para este recorte.</p>
        </section>
      )}
    </>
  );
}
