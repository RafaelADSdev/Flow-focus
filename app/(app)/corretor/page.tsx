import { BrokerPanel } from "@/components/broker-panel";
import { PageGreeting } from "@/components/page-greeting";
import { PageHeader } from "@/components/page-header";
import { getCarteiraData } from "@/lib/data/carteira";

export const metadata = { title: "Minha carteira" };

export default async function BrokerPage() {
  const carteira = await getCarteiraData();
  return (
    <>
      <PageGreeting nome={carteira.nome} />
      <PageHeader
        title="Minha carteira"
        description="Organize seu lote atual antes de captar novas oportunidades."
      />
      <BrokerPanel data={carteira} />
    </>
  );
}
