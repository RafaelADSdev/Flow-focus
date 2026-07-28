import { PageLoading } from "@/components/page-loading";

export default function EquipeLoading() {
  return (
    <PageLoading
      variant="table"
      label="Carregando equipe…"
      description="Buscando corretores e distribuição do pipeline."
    />
  );
}
