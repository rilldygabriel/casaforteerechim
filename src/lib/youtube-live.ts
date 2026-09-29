export const CHURCH_YOUTUBE_CHANNEL = "UCKNTxNCEZrPT-EHiU61qA2A";
export const CHURCH_YOUTUBE_LIVE_URL = `https://www.youtube.com/channel/${CHURCH_YOUTUBE_CHANNEL}/live`;

export type LiveVideo = { id: string; title: string; embeddable: boolean };
export type LiveSnapshot = { status: "live" | "offline" | "unknown"; video: LiveVideo | null };
export type LiveCache = {
  snapshot: LiveSnapshot;
  checked_at: string | null;
  discovery_at: string | null;
  search_day: string | null;
  search_count: number;
};
export type YoutubeVideo = {
  id?: string;
  snippet?: { channelId?: string; title?: string; liveBroadcastContent?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
  liveStreamingDetails?: { actualStartTime?: string; actualEndTime?: string };
};

// Search more frequently around services. Once live, always check the actual end,
// even after midnight or outside this discovery window.
export function discoveryIntervalMs(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (name: string) => parts.find((part) => part.type === name)?.value;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const serviceWindow = (value("weekday") === "Sun" && minutes >= 18 * 60 + 30)
    || (value("weekday") === "Wed" && minutes >= 19 * 60);
  return (serviceWindow ? 5 : 60) * 60_000;
}

export function youtubeQuotaDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function shouldDiscover(cache: LiveCache, now: Date) {
  const count = cache.search_day === youtubeQuotaDay(now) ? cache.search_count : 0;
  return count < 90 && (!cache.discovery_at
    || now.getTime() - Date.parse(cache.discovery_at) >= discoveryIntervalMs(now));
}

export function confirmedLiveVideo(video: YoutubeVideo): LiveVideo | null {
  if (!video.id || !/^[\w-]{11}$/.test(video.id)
    || video.snippet?.channelId !== CHURCH_YOUTUBE_CHANNEL
    || video.status?.privacyStatus !== "public"
    || video.snippet.liveBroadcastContent !== "live"
    || !video.liveStreamingDetails?.actualStartTime
    || video.liveStreamingDetails.actualEndTime) return null;
  return { id: video.id, title: video.snippet.title || "Culto ao vivo na Casa",
    embeddable: video.status.embeddable === true };
}

export function publicLiveSnapshot(cache: LiveCache | null, now = new Date()): LiveSnapshot {
  if (!cache?.checked_at) return { status: "unknown", video: null };
  const age = now.getTime() - Date.parse(cache.checked_at);
  const maxAge = cache.snapshot.status === "live" ? 180_000 : discoveryIntervalMs(now) + 180_000;
  if (!Number.isFinite(age) || age > maxAge || age < -60_000) {
    return { status: "unknown", video: null };
  }
  return cache.snapshot;
}
