import Link from "next/link";
export default function NotFound() { return <main className="error-page"><span className="not-found-code">404</span><h1>Pagina nao encontrada</h1><p>O endereco pode ter mudado ou voce nao possui acesso a esta area.</p><Link className="button button-primary" href="/corretor">Voltar para minha carteira</Link></main>; }
