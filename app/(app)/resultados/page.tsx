import { PageHeader } from "@/components/page-header";
import { ResultsPanel } from "@/components/results-panel";
import { requireResultadosAccess } from "@/lib/auth/require-resultados";
import { getBitrixPortalBaseUrl } from "@/lib/bitrix/portal";
import { getResultadosData } from "@/lib/data/resultados";

export const metadata = { title: "Resultados" };

export default async function ResultsPage() {
  await requireResultadosAccess();
  const data = await getResultadosData();
  return (
    <>
      <PageHeader title="Resultados" description="Acompanhe o destino dos leads captados pelo Flow Focus, sem sair da operação." />
      <ResultsPanel data={data} bitrixPortalBase={getBitrixPortalBaseUrl()} />
    </>
  );
}
