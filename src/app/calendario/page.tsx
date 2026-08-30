import type { Metadata } from "next";
import { CHURCH_EVENTS, EVENT_CATEGORIES, compareEvents, getSaoPauloDateKey, type ChurchEvent, type EventCategory } from "@/lib/calendar-events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import CalendarExperience from "./calendar-experience";

export const metadata: Metadata = {
  title: "Calendário da Casa",
  description: "Confira os cultos, encontros e programações especiais da Igreja Casa Forte Erechim.",
};

export const dynamic = "force-dynamic";

function category(value: string): EventCategory {
  return EVENT_CATEGORIES.includes(value as EventCategory) ? value as EventCategory : value === "Batismo" ? "Ceia e Batismo" : "Eventos especiais";
}

export default async function CalendarPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("events").select("id,title,slug,description,category,start_date,end_date,start_time,end_time,location,status,registration_enabled,registration_status,is_featured").eq("is_public", true).is("archived_at", null).neq("slug", "batismo-setembro-2026").order("start_date");
  const databaseEvents: ChurchEvent[] = (data ?? []).map((item) => ({
    id: `database-${item.id}`,
    title: item.title,
    startDate: item.start_date,
    endDate: item.end_date ?? undefined,
    startTime: item.start_time?.slice(0, 5) ?? undefined,
    endTime: item.end_time?.slice(0, 5) ?? undefined,
    category: category(item.category),
    description: item.description,
    location: item.location,
    status: item.status,
    featured: item.is_featured,
    registrationSlug: item.registration_enabled && item.registration_status === "open" ? item.slug : undefined,
    registrationLabel: item.registration_enabled ? item.registration_status === "open" ? "Inscrições abertas" : "Inscrições encerradas" : undefined,
  }));
  const databaseRegistrationSlugs = new Set((data ?? []).map((item) => item.slug));
  const events = [...CHURCH_EVENTS.filter((item) => !item.registrationSlug || !databaseRegistrationSlugs.has(item.registrationSlug)), ...databaseEvents].sort(compareEvents);
  return <CalendarExperience today={getSaoPauloDateKey()} events={events} />;
}
