import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { CHECKIN_EVENTS } from "@/lib/programs";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHURCH_LATITUDE = -27.6463616;
const CHURCH_LONGITUDE = -52.2682368;
const MAX_DISTANCE_METERS = 100;
const MAX_ACCURACY_METERS = 100;

type ActiveWindow = {
  eventKey: keyof typeof CHECKIN_EVENTS;
  date: string;
} | null;

function saoPauloParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});

  return {
    weekday: parts.weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function activeWindow(): ActiveWindow {
  const now = saoPauloParts();

  if (now.weekday === "Wed" && now.minutes >= 18 * 60 + 30 && now.minutes <= 21 * 60 + 30) {
    return { eventKey: "quarta-ensino", date: now.date };
  }

  if (now.weekday === "Sun" && now.minutes >= 17 * 60 && now.minutes <= 21 * 60 + 30) {
    return { eventKey: "domingo-casa", date: now.date };
  }

  return null;
}

function distanceMeters(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(targetLatitude - latitude);
  const longitudeDelta = radians(targetLongitude - longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude)) *
      Math.cos(radians(targetLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function approvedMember(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, applyAuthState, user: null, profile: null };

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,phone,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    applyAuthState,
    user,
    profile: profile?.approval_status === "approved" ? profile : null,
  };
}

export async function GET(request: NextRequest) {
  const { applyAuthState, user, profile } = await approvedMember(request);
  if (!user || !profile) {
    return applyAuthState(
      NextResponse.json({ eligible: false }, { status: 403 }),
    );
  }

  const active = activeWindow();
  return applyAuthState(
    NextResponse.json({
      eligible: Boolean(active),
      eventKey: active?.eventKey ?? null,
    }),
  );
}

export async function POST(request: NextRequest) {
  const { applyAuthState, user, profile } = await approvedMember(request);
  if (!user || !profile) {
    return applyAuthState(
      NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    );
  }

  const active = activeWindow();
  if (!active) {
    return applyAuthState(
      NextResponse.json(
        { error: "O check-in por localização está fora do horário." },
        { status: 400 },
      ),
    );
  }

  const body = (await request.json()) as {
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
  };
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = Math.round(Number(body.accuracy));

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > MAX_ACCURACY_METERS
  ) {
    return applyAuthState(
      NextResponse.json(
        { error: "A localização não está precisa o suficiente. Tente novamente." },
        { status: 400 },
      ),
    );
  }

  const distance = Math.round(
    distanceMeters(
      latitude,
      longitude,
      CHURCH_LATITUDE,
      CHURCH_LONGITUDE,
    ),
  );
  if (distance > MAX_DISTANCE_METERS) {
    return applyAuthState(
      NextResponse.json(
        { error: "Você ainda não está próximo da Casa Forte." },
        { status: 400 },
      ),
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return applyAuthState(
      NextResponse.json(
        { error: "Check-in temporariamente indisponível." },
        { status: 503 },
      ),
    );
  }

  const { url } = getSupabaseConfig();
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const event = CHECKIN_EVENTS[active.eventKey];
  const normalizedPhone =
    (profile.phone ?? "").replace(/\D/g, "").slice(0, 13) || null;
  const { error } = await admin.from("culto_checkins").upsert(
    {
      event_key: event.key,
      event_date: active.date,
      event_title: event.title,
      user_id: user.id,
      nome: profile.full_name.trim(),
      telefone: normalizedPhone,
      resposta: "presencial",
      presenca_status: "presente",
      presenca_registrada_em: new Date().toISOString(),
      checkin_origem: "localizacao",
      localizacao_distancia_m: distance,
      localizacao_precisao_m: accuracy,
    },
    { onConflict: "event_key,event_date,user_id" },
  );

  if (error) {
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível registrar sua presença." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(
    NextResponse.json({
      message: `Presença confirmada automaticamente no ${event.title}.`,
    }),
  );
}
