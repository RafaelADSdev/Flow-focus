import { AppShell } from "@/components/app-shell";
import { GeofenceGate } from "@/components/geofence-gate";
import { getCurrentUser } from "@/lib/data/usuario-atual";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <GeofenceGate>
      <AppShell user={user}>{children}</AppShell>
    </GeofenceGate>
  );
}
