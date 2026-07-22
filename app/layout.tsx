import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = { title: { default: "Flow Focus", template: "%s · Flow Focus" }, description: "Distribuicao inteligente e auditavel de oportunidades comerciais." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><QueryProvider>{children}</QueryProvider></body></html>;
}
