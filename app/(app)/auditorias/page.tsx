import { AuditPanel } from "@/components/audit-panel";
import { PageHeader } from "@/components/page-header";
import { getAuditoriasPainelData } from "@/lib/data/auditorias";
import { getBitrixPortalBaseUrl } from "@/lib/bitrix/portal";

export const metadata = { title: "Auditorias" };

export default async function AuditsPage() {
  const data = await getAuditoriasPainelData();
  return (
    <>
      <PageHeader title="Auditoria de leads" description="Valide cada tratativa. Um checklist completo libera uma vaga imediatamente." />
      <AuditPanel data={data} bitrixPortalBase={getBitrixPortalBaseUrl()} />
    </>
  );
}
