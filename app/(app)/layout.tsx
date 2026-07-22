import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/data/usuario-atual";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
