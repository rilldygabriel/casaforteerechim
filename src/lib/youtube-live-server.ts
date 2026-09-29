import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  CHURCH_YOUTUBE_CHANNEL, confirmedLiveVideo, publicLiveSnapshot,
  shouldDiscover, youtubeQuotaDay,
  type LiveCache, type LiveSnapshot, type YoutubeVideo,
} from "@/lib/youtube-live";

async function youtube<T>(resource: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "X-Goog-Api-Key": process.env.YOUTUBE_API_KEY! },
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  // Do not log credentials, request URLs, or provider response bodies.
  if (!response.ok) throw new Error(`YouTube HTTP ${response.status}`);
  const body = await response.json() as { items?: T[] };
  if (!Array.isArray(body.items)) throw new Error("YouTube response missing items");
  return body.items;
}

async function videos(ids: string[]) {
  if (!ids.length) return [];
  return youtube<YoutubeVideo>("videos", {
    part: "snippet,status,liveStreamingDetails", id: ids.join(","),
  });
}

export async function readLiveStatus(): Promise<LiveSnapshot> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from("youtube_live_status").select("snapshot,checked_at,discovery_at,search_day,search_count")
    .eq("channel_id", CHURCH_YOUTUBE_CHANNEL).single();
  if (error) throw new Error("Live cache unavailable");
  return publicLiveSnapshot(data as LiveCache);
}

export async function refreshLiveStatus() {
  if (!process.env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY ausente");
  const db = getSupabaseServiceClient();
  const now = new Date();
  // Atomic lease prevents concurrent cron deliveries from multiplying searches.
  const { data: cache, error } = await db.from("youtube_live_status")
    .update({ lease_until: new Date(now.getTime() + 50_000).toISOString() })
    .eq("channel_id", CHURCH_YOUTUBE_CHANNEL).lte("lease_until", now.toISOString())
    .select("snapshot,checked_at,discovery_at,search_day,search_count").maybeSingle();
  if (error) throw new Error("Live cache lease failed");
  if (!cache) return { skipped: true };
  const state = cache as LiveCache;
  let snapshot: LiveSnapshot | null = null;
  const save = async (values: Record<string, unknown>) => {
    const result = await db.from("youtube_live_status").update(values).eq("channel_id", CHURCH_YOUTUBE_CHANNEL);
    if (result.error) throw new Error("Live cache update failed");
  };

  if (state.snapshot.video?.id) {
    const items = await videos([state.snapshot.video.id]);
    const live = items.map(confirmedLiveVideo).find(Boolean) || null;
    snapshot = { status: live ? "live" : "offline", video: live };
    // Persist a confirmed end immediately, even if the subsequent search fails.
    await save({ snapshot, checked_at: now.toISOString() });
  }

  if (snapshot?.status !== "live" && shouldDiscover(state, now)) {
    const day = youtubeQuotaDay(now);
    // Record attempts before calling Google. Errors must not exhaust search quota.
    await save({ discovery_at: now.toISOString(), search_day: day,
      search_count: (state.search_day === day ? state.search_count : 0) + 1 });
    const results = await youtube<{ id?: { videoId?: string } }>("search", {
      part: "snippet", channelId: CHURCH_YOUTUBE_CHANNEL, type: "video",
      eventType: "live", maxResults: "10", order: "date",
    });
    const ids = results.map((item) => item.id?.videoId).filter((id): id is string => !!id && /^[\w-]{11}$/.test(id));
    const live = (await videos(ids)).map(confirmedLiveVideo).find(Boolean) || null;
    snapshot = { status: live ? "live" : "offline", video: live };
    await save({ snapshot, checked_at: now.toISOString() });
  }
  return { status: snapshot?.status ?? "unchanged" };
}
