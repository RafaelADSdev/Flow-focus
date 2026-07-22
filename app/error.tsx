"use client";
import { CircleAlert, RotateCcw } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="error-page"><CircleAlert size={30}/><h1>Não foi possível carregar esta área</h1><p>Seus dados estão seguros. Tente novamente; se o problema continuar, fale com o administrador.</p><button className="button button-primary" onClick={reset}><RotateCcw size={17}/>Tentar novamente</button></main>; }
