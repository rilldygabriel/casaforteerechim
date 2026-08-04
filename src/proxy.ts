import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

const PUBLIC_ADMIN_ROUTES = new Set([
  "/admin/callback",
  "/admin/recuperar-senha",
  "/admin/redefinir-senha",
]);

const PUBLIC_FAMILY_ROUTES = new Set([
  "/familia/aceitar-convite",
  "/familia/cadastro",
  "/familia/callback",
]);

const LOGIN_ROUTES = new Set(["/admin/login", "/familia/login"]);

function preventAuthPageCache(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  return response;
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies
    .getAll()
    .filter(({ name }) => name.startsWith("sb-"))
    .forEach(({ name }) => {
      response.cookies.set(name, "", {
        expires: new Date(0),
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });
    });

  return preventAuthPageCache(response);
}

function getExpiredSessionResponse(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = isAdminRoute ? "/admin/login" : "/familia/login";
  loginUrl.search = "?erro=sessao-expirada";

  return clearSupabaseCookies(request, NextResponse.redirect(loginUrl));
}

export async function proxy(request: NextRequest) {
  if (
    PUBLIC_ADMIN_ROUTES.has(request.nextUrl.pathname) ||
    PUBLIC_FAMILY_ROUTES.has(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  try {
    const { error } = await supabase.auth.getClaims();

    if (error) {
      if (LOGIN_ROUTES.has(request.nextUrl.pathname)) {
        return clearSupabaseCookies(request, NextResponse.next({ request }));
      }
      return getExpiredSessionResponse(request);
    }
  } catch {
    if (LOGIN_ROUTES.has(request.nextUrl.pathname)) {
      return clearSupabaseCookies(request, NextResponse.next({ request }));
    }
    return getExpiredSessionResponse(request);
  }

  return preventAuthPageCache(response);
}

export const config = {
  matcher: ["/admin/:path*", "/familia/:path*"],
};
