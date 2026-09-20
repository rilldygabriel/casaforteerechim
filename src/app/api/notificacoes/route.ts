import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NotificationItem = {
  id: string;
  type: "message" | "news";
  title: string;
  preview: string;
  publishedAt: string;
  href: string;
};

function preview(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 130 ? `${compact.slice(0, 127)}…` : compact;
}

export async function GET(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return applyAuthState(NextResponse.json({ authenticated: false, totalUnread: 0, items: [] }));
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) {
    return applyAuthState(NextResponse.json({ authenticated: true, available: false, totalUnread: 0, items: [] }));
  }

  const [announcementsResult, announcementReadsResult, newsResult, newsReadsResult] = await Promise.all([
    supabase.from("family_announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("family_announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase.from("news_posts").select("id,slug,title,body,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(200),
    supabase.from("news_post_reads").select("news_id").eq("user_id", user.id),
  ]);

  if (announcementsResult.error || announcementReadsResult.error || newsResult.error || newsReadsResult.error) {
    console.error("notification_center_query_failed", {
      announcements: announcementsResult.error?.message,
      announcementReads: announcementReadsResult.error?.message,
      news: newsResult.error?.message,
      newsReads: newsReadsResult.error?.message,
    });
    return applyAuthState(NextResponse.json({ error: "Não foi possível carregar as notificações." }, { status: 500 }));
  }

  const readAnnouncements = new Set((announcementReadsResult.data ?? []).map((item) => item.announcement_id));
  const readNews = new Set((newsReadsResult.data ?? []).map((item) => item.news_id));
  const items: NotificationItem[] = [
    ...(announcementsResult.data ?? [])
      .filter((item) => !readAnnouncements.has(item.id))
      .map((item) => ({
        id: item.id,
        type: "message" as const,
        title: item.title,
        preview: preview(item.body),
        publishedAt: item.created_at,
        href: `/familia/notificacoes#mensagem-${item.id}`,
      })),
    ...(newsResult.data ?? [])
      .filter((item) => !readNews.has(item.id))
      .map((item) => ({
        id: item.id,
        type: "news" as const,
        title: item.title,
        preview: preview(item.body),
        publishedAt: item.published_at,
        href: `/noticias/${item.slug}`,
      })),
  ].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  return applyAuthState(NextResponse.json({ authenticated: true, available: true, totalUnread: items.length, items }));
}

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return applyAuthState(NextResponse.json({ error: "Acesso não autenticado." }, { status: 401 }));

  const body = await request.json().catch(() => null) as { id?: unknown; type?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const type = body?.type;
  if (!UUID.test(id) || (type !== "message" && type !== "news")) {
    return applyAuthState(NextResponse.json({ error: "Notificação inválida." }, { status: 400 }));
  }

  const readAt = new Date().toISOString();
  const { error } = type === "message"
    ? await supabase.from("family_announcement_reads").upsert(
        { announcement_id: id, user_id: user.id, read_at: readAt },
        { onConflict: "announcement_id,user_id" },
      )
    : await supabase.from("news_post_reads").upsert(
        { news_id: id, user_id: user.id, read_at: readAt },
        { onConflict: "news_id,user_id" },
      );

  if (error) {
    console.error("notification_mark_read_failed", { id, type, error: error.message });
    return applyAuthState(NextResponse.json({ error: "Não foi possível marcar a notificação como lida." }, { status: 500 }));
  }

  return applyAuthState(NextResponse.json({ ok: true }));
}
