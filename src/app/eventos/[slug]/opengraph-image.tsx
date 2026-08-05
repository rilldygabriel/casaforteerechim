import { ImageResponse } from "next/og";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const alt = "Evento da Igreja Casa Forte Erechim";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function shortDate(value: string | null) {
  if (!value) return { day: "", month: "" };
  const date = new Date(`${value}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(date).toUpperCase(),
  };
}

function shortTime(value: string | null) {
  if (!value) return "";
  const [hour, minute] = value.split(":");
  return minute === "00" ? `${Number(hour)}H` : `${Number(hour)}H${minute}`;
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: event } = await getSupabaseServiceClient()
    .from("events")
    .select("title,start_date,start_time,end_time,location")
    .eq("slug", slug)
    .maybeSingle();
  const date = shortDate(event?.start_date ?? null);
  const time = [shortTime(event?.start_time ?? null), shortTime(event?.end_time ?? null)].filter(Boolean).join(" — ");

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#10140a", color: "#f7f7ef", padding: "58px 68px", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 460, height: 460, borderRadius: 999, background: "#dfff31", opacity: 0.09, right: -100, top: -170 }} />
      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "2px solid rgba(223,255,49,.38)", borderRadius: 34, padding: "48px 52px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 42, height: 42, border: "3px solid #dfff31", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⌂</div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: -1 }}>IGREJA CASA FORTE</div>
          </div>
          <div style={{ display: "flex", color: "#dfff31", fontSize: 23, fontWeight: 700, letterSpacing: 3 }}>INSCRIÇÕES ABERTAS</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 50 }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 220 }}>
            <div style={{ display: "flex", color: "#dfff31", fontSize: 150, lineHeight: 0.82, fontWeight: 900, letterSpacing: -10 }}>{date.day}</div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 29, fontWeight: 800, letterSpacing: 4 }}>{date.month}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 4 }}>
            <div style={{ display: "flex", fontSize: 78, lineHeight: 0.98, fontWeight: 900, letterSpacing: -5 }}>{event?.title ?? "Evento Casa Forte"}</div>
            <div style={{ display: "flex", marginTop: 23, color: "#dfff31", fontSize: 29, fontWeight: 800 }}>{time}</div>
            <div style={{ display: "flex", marginTop: 10, color: "#c9cbbf", fontSize: 23 }}>{event?.location || "Igreja Casa Forte Erechim"}</div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
