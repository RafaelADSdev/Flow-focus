import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Ajuda" };

export default function HelpPage() {
  return <><PageHeader title="Central de ajuda" description="Entenda o ciclo de captacao, trabalho, auditoria e liberacao."/><div className="empty-state"><h2>Documentacao operacional em preparacao</h2><p>Em caso de bloqueio ou divergencia de carteira, procure a lideranca da sua equipe.</p></div></>;
}
