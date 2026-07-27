import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  firstAllowedPath,
  normalizePaginasAcesso,
} from "@/lib/auth/paginas-acesso";
import { mapPerfil } from "@/lib/auth/perfil";
import type { Database } from "@/lib/database.types";
import { getSupabaseEnv } from "./env";

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
  const isLogin = pathname.startsWith("/login");
  const isPublic = isLogin || pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const perfilFromAuth = mapPerfil(String(user.app_metadata?.perfil ?? ""));
    let profile: { perfil: Database["public"]["Tables"]["usuarios"]["Row"]["perfil"] | null; paginas_acesso?: string[] | null } | null = null;

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

    const perfil = profile?.perfil ?? perfilFromAuth;
    const paginas = normalizePaginasAcesso(perfil, profile?.paginas_acesso);
    const homePath = firstAllowedPath(paginas);

    if (isLogin) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = homePath;
      return NextResponse.redirect(homeUrl);
    }

    if (!isPublic && pathname !== "/" && !canAccessPath(paginas, pathname)) {
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = homePath;
      return NextResponse.redirect(deniedUrl);
    }
  }

  return response;
}
