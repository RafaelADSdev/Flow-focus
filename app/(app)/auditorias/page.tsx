import { AuditPanel } from "@/components/audit-panel";
import { PageHeader } from "@/components/page-header";
import { getAuditoriasPainelData } from "@/lib/data/auditorias";

export const metadata = { title: "Auditorias" };

export default async function AuditsPage() {
  const data = await getAuditoriasPainelData();
  return (
    <>
      <PageHeader title="Auditoria de carteiras" description="Revise o trabalho no Bitrix24 e decida quem está pronto para um novo lote." />
      <AuditPanel data={data} />
    </>
  );
}
