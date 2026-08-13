import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "domingo-casa",
  "quarta-ensino",
  "sexta-oracao",
]);

type SubscriptionPayload = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  events?: unknown;
};

async function getApprovedMember(request: NextRequest) {
  const routeClient = getSupabaseRouteClient(request);
  const {
    data: { user },
  } = await routeClient.supabase.auth.getUser();

  if (!user) return { ...routeClient, user: null, approved: false };

  const { data: profile } = await routeClient.supabase
    .from("member_profiles")
    .select("approval_status,is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    ...routeClient,
    user,
    approved:
      profile?.approval_status === "approved" || profile?.is_admin === true,
  };
}

function adminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  const { url } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  const { user, approved, applyAuthState } = await getApprovedMember(request);

  if (!user || !approved) {
    return applyAuthState(
      NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 }),
    );
  }

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return applyAuthState(
      NextResponse.json(
        { error: "Notificações indisponíveis no momento." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(NextResponse.json({ publicKey }));
}

export async function POST(request: NextRequest) {
  const { user, approved, applyAuthState } = await getApprovedMember(request);

  if (!user || !approved) {
    return applyAuthState(
      NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 }),
    );
  }

  let payload: SubscriptionPayload;
  try {
    payload = (await request.json()) as SubscriptionPayload;
  } catch {
    return applyAuthState(
      NextResponse.json({ error: "Dados inválidos." }, { status: 400 }),
    );
  }

  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
  const p256dh =
    typeof payload.keys?.p256dh === "string" ? payload.keys.p256dh : "";
  const authKey = typeof payload.keys?.auth === "string" ? payload.keys.auth : "";
  const events = Array.isArray(payload.events)
    ? [...new Set(payload.events.filter((event): event is string =>
        typeof event === "string" && ALLOWED_EVENTS.has(event),
      ))]
    : [];

  if (
    !endpoint.startsWith("https://") ||
    endpoint.length > 4096 ||
    p256dh.length < 20 ||
    authKey.length < 8 ||
    events.length === 0
  ) {
    return applyAuthState(
      NextResponse.json({ error: "Inscrição inválida." }, { status: 400 }),
    );
  }

  const admin = adminClient();
  if (!admin) {
    return applyAuthState(
      NextResponse.json(
        { error: "Notificações indisponíveis no momento." },
        { status: 503 },
      ),
    );
  }

  const { error } = await admin.from("web_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth_key: authKey,
      enabled_events: events,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
      updated_at: new Date().toISOString(),
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("web_push_subscription_save_failed", error.code);
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível ativar as notificações." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(NextResponse.json({ subscribed: true }));
}

export async function DELETE(request: NextRequest) {
  const { user, approved, applyAuthState } = await getApprovedMember(request);

  if (!user || !approved) {
    return applyAuthState(
      NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 }),
    );
  }

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  } catch {
    endpoint = "";
  }

  if (!endpoint) {
    return applyAuthState(
      NextResponse.json({ error: "Inscrição inválida." }, { status: 400 }),
    );
  }

  const admin = adminClient();
  if (!admin) {
    return applyAuthState(
      NextResponse.json(
        { error: "Notificações indisponíveis no momento." },
        { status: 503 },
      ),
    );
  }

  const { error } = await admin
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("web_push_subscription_delete_failed", error.code);
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível desativar as notificações." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(NextResponse.json({ subscribed: false }));
}
