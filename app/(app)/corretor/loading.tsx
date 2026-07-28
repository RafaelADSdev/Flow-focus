import { PageLoading } from "@/components/page-loading";

export default function CarteiraLoading() {
  return (
    <PageLoading
      variant="carteira"
      label="Carregando carteira…"
      description="Buscando roletas, limite diário e capturas recentes."
    />
  );
}
