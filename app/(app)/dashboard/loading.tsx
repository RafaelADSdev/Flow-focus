import { PageLoading } from "@/components/page-loading";

export default function DashboardLoading() {
  return (
    <PageLoading
      variant="table"
      label="Carregando dashboard…"
      description="Consolidando indicadores e filtros da operação."
    />
  );
}
