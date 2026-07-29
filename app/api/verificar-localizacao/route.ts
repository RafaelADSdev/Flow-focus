import { NextResponse } from "next/server";
import { GeofenceConfigError, geoRenewalIntervalMs } from "@/lib/geofence/config";
import { getActiveGeofenceConfig } from "@/lib/data/geofence-settings";
import { haversineDistanceMeters, isValidGeographicPoint } from "@/lib/geofence/distance";
import {
  createGeoSessionToken,
  expiredGeoCookieOptions,
  GEO_SESSION_COOKIE,
  geoCookieOptions,
} from "@/lib/geofence/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function authenticatedUserId() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function persistDatabaseSession(userId: string, expiresAt: Date) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("registrar_geo_sessao", {
    p_expires_at: expiresAt.toISOString(),
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
}

function clearGeoCookie(response: NextResponse) {
  response.cookies.set(GEO_SESSION_COOKIE, "", expiredGeoCookieOptions);
  return response;
}

function unauthorizedResponse() {
  return clearGeoCookie(NextResponse.json(
    { erro: "Sess\u00e3o de usu\u00e1rio inv\u00e1lida" },
    { status: 401, headers: NO_STORE_HEADERS },
  ));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { erro: "Origem da requisi\u00e7\u00e3o n\u00e3o autorizada" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const userId = await authenticatedUserId();
  if (!userId) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { erro: "Envie latitude e longitude em um JSON v\u00e1lido" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const latitude = typeof body === "object" && body !== null && "latitude" in body
    ? (body as { latitude?: unknown }).latitude
    : undefined;
  const longitude = typeof body === "object" && body !== null && "longitude" in body
    ? (body as { longitude?: unknown }).longitude
    : undefined;
  if (
    typeof latitude !== "number"
    || typeof longitude !== "number"
    || !isValidGeographicPoint({ latitude, longitude })
  ) {
    return NextResponse.json(
      { erro: "Latitude ou longitude inv\u00e1lida" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const currentPosition = { latitude, longitude };

  try {
    // The browser only reports a reading; office coordinates, radius and authorization
    // stay server-side so DevTools cannot redefine the protected perimeter.
    const config = await getActiveGeofenceConfig();
    const distance = haversineDistanceMeters(currentPosition, config.office);
    const roundedDistance = Math.round(distance * 10) / 10;

    if (distance > config.radiusMeters) {
      // Expiring the database record also closes direct Data API access protected by RLS.
      await persistDatabaseSession(userId, new Date(0)).catch((error: unknown) => {
        console.error("Falha ao revogar a geo-sess\u00e3o no Supabase:", error);
      });

      return clearGeoCookie(NextResponse.json(
        { permitido: false, distancia: roundedDistance },
        { status: 200, headers: NO_STORE_HEADERS },
      ));
    }

    const session = await createGeoSessionToken(
      userId,
      config.sessionSeconds,
      config.signingSecret,
    );
    const expiresAt = new Date(session.expiresAt);

    // Create the cookie only after storing the matching database expiration.
    await persistDatabaseSession(userId, expiresAt);

    const response = NextResponse.json(
      {
        permitido: true,
        distancia: roundedDistance,
        renovarEmMs: geoRenewalIntervalMs(config.sessionSeconds),
      },
      { headers: NO_STORE_HEADERS },
    );

    // httpOnly blocks page scripts; HMAC also protects against manual cookie edits.
    response.cookies.set(GEO_SESSION_COOKIE, session.token, geoCookieOptions(config.sessionSeconds));
    return response;
  } catch (error) {
    const message = error instanceof GeofenceConfigError
      ? "A cerca virtual ainda n\u00e3o foi configurada no servidor."
      : "N\u00e3o foi poss\u00edvel validar a localiza\u00e7\u00e3o agora.";

    console.error("Falha na valida\u00e7\u00e3o de geofence:", error);
    return clearGeoCookie(NextResponse.json(
      { erro: message },
      { status: 503, headers: NO_STORE_HEADERS },
    ));
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { erro: "Origem da requisi\u00e7\u00e3o n\u00e3o autorizada" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const userId = await authenticatedUserId();
  if (userId) {
    await persistDatabaseSession(userId, new Date(0)).catch((error: unknown) => {
      console.error("Falha ao encerrar a geo-sess\u00e3o no Supabase:", error);
    });
  }

  return clearGeoCookie(new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS }));
}
