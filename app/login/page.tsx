import { LoginBrandLockup } from "@/components/login-brand-lockup";
import { LoginForm } from "@/components/login-form";
import { LoginOrbit } from "@/components/login-orbit";

export const metadata = { title: "Entrar" };

const CYCLE = ["Captar", "Trabalhar", "Auditar", "Liberar"] as const;

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <LoginBrandLockup />
        <div className="login-copy">
          <p className="login-kicker">Diretoria Focus</p>
          <h1>Entre na operação</h1>
          <p>Roletas, carteiras e auditoria — Bitrix24 permanece o CRM.</p>
        </div>
        <div className="login-mobile-authority">
          <ol className="login-cycle-strip" aria-label="Ciclo operacional">
            {CYCLE.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <blockquote cite="Flow Focus">
            “Cada oportunidade tem dono, próximo passo e histórico.”
          </blockquote>
        </div>
        <LoginForm />
        <footer>Flow Focus · HubOn · Integrado ao Bitrix24</footer>
      </section>
      <aside className="login-aside" aria-label="Resumo do fluxo operacional">
        <LoginOrbit />
        <blockquote cite="Flow Focus">
          “Cada oportunidade tem dono, próximo passo e histórico.”
        </blockquote>
        <p>Uma rotina comercial mais organizada, equilibrada e rastreável.</p>
      </aside>
    </main>
  );
}
