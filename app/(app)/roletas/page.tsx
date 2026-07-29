import { PageHeader } from "@/components/page-header";
import { RouletteConfig } from "@/components/roulette-config";
import { getRoletasConfigData } from "@/lib/data/roletas-config";

export const metadata = { title: "Roletas por corretor" };

export default async function RoulettesPage() {
  const data = await getRoletasConfigData();
  return (
    <>
      <PageHeader
        title="Roletas por corretor"
        description="Defina as fontes que cada corretor pode captar. Alterações ficam em rascunho até o salvamento, e bloqueios continuam visíveis antes da decisão."
      />
      <RouletteConfig key={data.gerado_em} data={data} />
    </>
  );
}
