import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  firstAllowedPath,
  normalizePaginasAcesso,
  resolvePaginasAcesso,
} from "@/lib/auth/paginas-acesso";
import { mapPerfil } from "@/lib/auth/perfil";
import type { Database } from "@/lib/database.types";
import { getGeoSessionConfig } from "@/lib/geofence/config";
import {
  isGeofenceProtectedRequest,
  isGeofenceVerificationPath,
} from "@/lib/geofence/routes";
import {
  expiredGeoCookieOptions,
  GEO_SESSION_COOKIE,
  isValidGeoSessionToken,
} from "@/lib/geofence/session";
import { getSupabaseEnv } from "./env";

function transferResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

function redirectWithSessionCookies(source: NextResponse, request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return transferResponseCookies(source, NextResponse.redirect(url));
}

function clearInvalidGeoCookie(response: NextResponse) {
  response.cookies.set(GEO_SESSION_COOKIE, "", expiredGeoCookieOptions);
  return response;
}
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isLogin = pathname.startsWith("/login");
  const isAuthPublic = isLogin || pathname.startsWith("/auth");
  const isGeoVerification = isGeofenceVerificationPath(pathname);

  if (!user && !isAuthPublic) {
    if (isApi) {
      return transferResponseCookies(response, NextResponse.json(
        { erro: "Sess\u00e3o de usu\u00e1rio inv\u00e1lida" },
        { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      ));
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return transferResponseCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user) {
    const perfilFromAuth = mapPerfil(String(user.app_metadata?.perfil ?? ""));
    let homePath = firstAllowedPath(normalizePaginasAcesso(perfilFromAuth, null));
    let profile: {
      perfil: Database["public"]["Tables"]["usuarios"]["Row"]["perfil"] | null;
      paginas_acesso?: string[] | null;
    } | null = null;

    // The verification route must work before a geofence RLS session exists.
    if (!isGeoVerification) {
      const withPages = await supabase
        .from("usuarios")
        .select("perfil, paginas_acesso")
        .eq("id", user.id)
        .maybeSingle();

      if (withPages.error?.message?.includes("paginas_acesso")) {
        const fallback = await supabase
          .from("usuarios")
          .select("perfil")
          .eq("id", user.id)
          .maybeSingle();
        profile = fallback.data;
      } else {
        profile = withPages.data;
      }
    }

    const perfil = profile?.perfil ?? perfilFromAuth;
    const paginas = resolvePaginasAcesso(perfil, profile?.paginas_acesso);
    homePath = firstAllowedPath(paginas);

    if (isLogin) {
      return redirectWithSessionCookies(response, request, homePath);
    }

    if (!isApi && !isAuthPublic && !isGeoVerification && pathname !== "/" && !canAccessPath(paginas, pathname)) {
      return redirectWithSessionCookies(response, request, homePath);
    }

    if (isGeofenceProtectedRequest(pathname)) {
      let validGeoSession = false;
      try {
        const config = getGeoSessionConfig();
        validGeoSession = await isValidGeoSessionToken(
          request.cookies.get(GEO_SESSION_COOKIE)?.value,
          user.id,
          config.signingSecret,
        );
      } catch {
        // Missing config and malformed tokens both fail closed.
      }

      if (!validGeoSession) {
        if (isApi) {
          return clearInvalidGeoCookie(transferResponseCookies(response, NextResponse.json(
            { erro: "Fora do local permitido" },
            { status: 403, headers: { "Cache-Control": "private, no-store, max-age=0" } },
          )));
        }

        const verificationUrl = request.nextUrl.clone();
        verificationUrl.pathname = "/verificar-localizacao";
        verificationUrl.search = "";
        verificationUrl.searchParams.set("retorno", `${pathname}${request.nextUrl.search}`);
        return clearInvalidGeoCookie(transferResponseCookies(
          response,
          NextResponse.redirect(verificationUrl),
        ));
      }
    }
  }

  return response;
}
