import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "cf_app_download_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

const STORE_URLS = {
  ios: "https://apps.apple.com/br/app/casa-forte-erechim/id6740501695",
  android: "https://play.google.com/store/apps/details?id=com.casaforteerechim.app&hl=pt_BR",
} as const;

type AppPlatform = keyof typeof STORE_URLS;

function isAppPlatform(value: string): value is AppPlatform {
  return value === "ios" || value === "android";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> },
) {
  const { platform } = await context.params;
  if (!isAppPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 404 });
  }

  const existingDeviceToken = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceToken = existingDeviceToken && /^[0-9a-f-]{36}$/i.test(existingDeviceToken)
    ? existingDeviceToken
    : crypto.randomUUID();
  const requestedSource = request.nextUrl.searchParams.get("source") || "";
  const source = /^[a-z0-9_-]{1,80}$/i.test(requestedSource)
    ? requestedSource
    : "home_header";

  try {
    const service = getSupabaseServiceClient();
    const now = new Date().toISOString();

    const { error } = await service.from("app_download_events").upsert(
      {
        platform,
        device_token: deviceToken,
        source,
        user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
        last_clicked_at: now,
      },
      { onConflict: "device_token,platform" },
    );

    if (error) console.error("app_download_event_save_failed", error.code);
  } catch (error) {
    console.error("app_download_event_unexpected_error", error instanceof Error ? error.message : "unknown");
  }

  const response = NextResponse.redirect(STORE_URLS[platform], 307);
  response.cookies.set(DEVICE_COOKIE, deviceToken, {
    httpOnly: true,
    maxAge: ONE_YEAR,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
