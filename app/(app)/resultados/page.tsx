import { PageHeader } from "@/components/page-header";
import { ResultsPanel } from "@/components/results-panel";
import { requireResultadosAccess } from "@/lib/auth/require-resultados";
import { getBitrixPortalBaseUrl } from "@/lib/bitrix/portal";
import { getResultadosData } from "@/lib/data/resultados";
import { parseResultadosDateRange } from "@/lib/resultados-filters";

export const metadata = { title: "Resultados" };

type ResultsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  await requireResultadosAccess();
  const range = parseResultadosDateRange(await searchParams);
  const data = await getResultadosData(range);
  return (
    <>
      <PageHeader title="Resultados" description="Acompanhe o destino dos leads captados pelo Flow Focus, sem sair da operação." />
      <ResultsPanel data={data} range={range} bitrixPortalBase={getBitrixPortalBaseUrl()} />
    </>
  );
}
