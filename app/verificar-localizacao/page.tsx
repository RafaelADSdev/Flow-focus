import type { Route } from "next";
import { GeofenceGate } from "@/components/geofence-gate";
import { sanitizeGeofenceReturnPath } from "@/lib/geofence/routes";

export const metadata = { title: "Verificar localiza\u00e7\u00e3o" };

type LocationVerificationPageProps = {
  searchParams: Promise<{ retorno?: string | string[] }>;
};

export default async function LocationVerificationPage({ searchParams }: LocationVerificationPageProps) {
  const params = await searchParams;
  return <GeofenceGate redirectTo={sanitizeGeofenceReturnPath(params.retorno) as Route} />;
}

