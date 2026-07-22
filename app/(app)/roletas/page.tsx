import { PageHeader } from "@/components/page-header";
import { RouletteConfig } from "@/components/roulette-config";

export const metadata = { title: "Configuracao de roletas" };
export default function RoulettesPage() { return <><PageHeader title="Roletas por corretor" description="Defina quais fontes de oportunidade cada pessoa da equipe pode acessar."/><RouletteConfig/></>; }
