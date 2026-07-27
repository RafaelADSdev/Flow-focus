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
        description="Defina quais fontes de oportunidade cada pessoa pode visualizar e captar. Bloqueios e auditoria aparecem antes da permissão."
      />
      <RouletteConfig data={data} />
    </>
  );
}
