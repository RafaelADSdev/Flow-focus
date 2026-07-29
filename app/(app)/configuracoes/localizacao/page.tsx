import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import { GeofenceSettingsForm } from "@/components/geofence-settings-form";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getGeofenceSettingsData } from "@/lib/data/geofence-settings";

export const metadata = { title: "Localiza\u00e7\u00e3o do escrit\u00f3rio" };

export default async function GeofenceSettingsPage() {
  await requireAdmin();
  const settings = await getGeofenceSettingsData();

  return (
    <div className="admin-page geo-settings-page">
      <header className="admin-hero">
        <div className="admin-hero-copy">
          <span className="admin-eyebrow">{"Administra\u00e7\u00e3o"}</span>
          <div className="admin-hero-title">
            <MapPinned size={24} strokeWidth={1.8} aria-hidden="true" />
            <h1>{"Localiza\u00e7\u00e3o do escrit\u00f3rio"}</h1>
          </div>
          <p>{"Defina o ponto central e o raio que liberam o acesso \u00e0 opera\u00e7\u00e3o."}</p>
        </div>
        <Link href="/configuracoes" className="button button-secondary admin-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {"Voltar \u00e0s configura\u00e7\u00f5es"}
        </Link>
      </header>

      <GeofenceSettingsForm initialData={settings} />
    </div>
  );
}
