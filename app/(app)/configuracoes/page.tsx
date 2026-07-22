import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Configuracoes" };

export default function SettingsPage() {
  return <><PageHeader title="Configuracoes" description="Integracoes, permissoes e parametros gerais do Flow Focus."/><div className="empty-state"><h2>Configuracao centralizada em breve</h2><p>As definicoes de roletas ja estao disponiveis. Integracoes e parametros globais entram na proxima etapa.</p></div></>;
}
