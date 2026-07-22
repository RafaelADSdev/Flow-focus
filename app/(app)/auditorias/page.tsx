import { AuditPanel } from "@/components/audit-panel";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Auditorias" };
export default function AuditsPage() { return <><PageHeader title="Auditoria de carteiras" description="Revise o trabalho no Bitrix24 e decida quem esta pronto para um novo lote."/><AuditPanel/></>; }
