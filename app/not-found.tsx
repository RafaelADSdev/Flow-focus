import Link from "next/link";
export default function NotFound() { return <main className="error-page"><span className="not-found-code">404</span><h1>Página não encontrada</h1><p>O endereço pode ter mudado ou você não possui acesso a esta área.</p><Link className="button button-primary" href="/corretor">Voltar para minha carteira</Link></main>; }
