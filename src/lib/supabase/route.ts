import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

type CookiesToSet = Parameters<
  NonNullable<CookieMethodsServer["setAll"]>
>[0];

export function getSupabaseRouteClient(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  const pendingCookies: CookiesToSet = [];
  const pendingHeaders = new Headers();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        Object.entries(headers).forEach(([name, value]) =>
          pendingHeaders.set(name, value),
        );
      },
    },
  });

  function applyAuthState(response: NextResponse) {
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
    pendingHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
  }

  return { supabase, applyAuthState };
}
