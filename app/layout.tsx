import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { plusJakartaSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { default: "Flow Focus", template: "%s · Flow Focus" },
  description: "Distribuição inteligente e auditável de oportunidades comerciais.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable} suppressHydrationWarning>
      <body className={plusJakartaSans.className} suppressHydrationWarning>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
