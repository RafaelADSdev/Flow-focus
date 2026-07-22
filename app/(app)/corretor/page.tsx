import { BrokerPanel } from "@/components/broker-panel";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Minha carteira" };
export default function BrokerPage() { return <><PageHeader title="Bom dia, Bruno" description="Organize seu lote atual antes de captar novas oportunidades."/><BrokerPanel/></>; }
