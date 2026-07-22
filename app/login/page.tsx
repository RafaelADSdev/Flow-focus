import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return <main className="login-page"><section className="login-panel"><BrandMark variant="on-light"/><div className="login-copy"><span className="login-tag"><ShieldCheck size={15}/>Acesso seguro da Diretoria Focus</span><h1>Oportunidades em movimento. Operação sob controle.</h1><p>Acesse suas roletas, acompanhe carteiras e mantenha o ciclo comercial fluindo.</p></div><LoginForm/><footer>Flow Focus · Integrado ao Bitrix24</footer></section><aside className="login-aside" aria-label="Resumo do fluxo operacional"><div className="aside-orbit"><span className="orbit-core"><i/><i/><i/></span><span className="orbit-label label-one">Captar</span><span className="orbit-label label-two">Trabalhar</span><span className="orbit-label label-three">Auditar</span><span className="orbit-label label-four">Liberar</span></div><blockquote>“Cada oportunidade tem dono, próximo passo e histórico.”</blockquote><p>Uma rotina comercial mais organizada, equilibrada e rastreável.</p></aside></main>;
}
