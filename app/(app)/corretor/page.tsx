import { BrokerPanel } from "@/components/broker-panel";
import { PageGreeting } from "@/components/page-greeting";
import { PageHeader } from "@/components/page-header";
import { getBitrixPortalBaseUrl } from "@/lib/bitrix/portal";
import { getCarteiraData } from "@/lib/data/carteira";

export const metadata = { title: "Minha carteira" };

export default async function BrokerPage() {
  const carteira = await getCarteiraData();
  return (
    <>
      <PageGreeting nome={carteira.nome} />
      <PageHeader
        title="Minha carteira"
        description="Acompanhe sua capacidade ativa. Cada lead aprovado pela liderança libera uma nova vaga."
      />
      <BrokerPanel data={carteira} bitrixPortalBase={getBitrixPortalBaseUrl()} />
    </>
  );
}
