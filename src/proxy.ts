import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

const PUBLIC_ADMIN_ROUTES = new Set([
  "/admin/login",
  "/admin/callback",
  "/admin/recuperar-senha",
  "/admin/redefinir-senha",
]);

const PUBLIC_FAMILY_ROUTES = new Set([
  "/familia/aceitar-convite",
  "/familia/login",
  "/familia/cadastro",
  "/familia/callback",
]);

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

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/familia/:path*"],
};
