import { getSupabaseServiceClient } from "@/lib/supabase/service";
import BirthdayCarouselClient, { type BirthdayDay } from "./birthday-carousel-client";

function saoPauloDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateWindow() {
  const [year, month, day] = saoPauloDateKey().split("-").map(Number);
  return Array.from({ length: 10 }, (_, index) => {
    const offset = index - 4;
    const date = new Date(Date.UTC(year, month - 1, day + offset));
    const key = date.toISOString().slice(0, 10);
    const monthDay = key.slice(5);
    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      weekday: "short",
    }).format(date);

    return { key, monthDay, dateLabel, weekday, isToday: offset === 0 };
  });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function BirthdayCarousel({
  variant,
}: {
  variant: "public" | "family";
}) {
  const days = dateWindow();
  let carouselDays: BirthdayDay[] = days.map((day) => ({ ...day, people: [] }));

  try {
    const service = getSupabaseServiceClient();
    const { data: profiles } = await service
      .from("member_profiles")
      .select("user_id,full_name,birth_date,photo_url")
      .not("birth_date", "is", null)
      .or("approval_status.eq.approved,is_admin.eq.true")
      .order("full_name");
    const visibleMonthDays = new Set(days.map((day) => day.monthDay));
    const matchingProfiles = (profiles ?? []).filter((profile) =>
      visibleMonthDays.has(profile.birth_date?.slice(5) ?? ""),
    );
    const photoUrls = new Map<string, string>();

    await Promise.all(matchingProfiles.map(async (profile) => {
      if (!profile.photo_url) return;
      const { data } = await service.storage
        .from("member-profile-photos")
        .createSignedUrl(profile.photo_url, 60 * 60);
      if (data?.signedUrl) photoUrls.set(profile.user_id, data.signedUrl);
    }));

    carouselDays = days.map((day) => ({
      ...day,
      people: matchingProfiles
        .filter((profile) => profile.birth_date?.slice(5) === day.monthDay)
        .map((profile) => ({
          id: profile.user_id,
          name: profile.full_name || "Membro Casa Forte",
          initials: initials(profile.full_name || "Membro Casa Forte"),
          photoUrl: photoUrls.get(profile.user_id) ?? null,
        })),
    }));
  } catch {
    // O carrossel continua mostrando a janela de datas se o serviço estiver indisponível.
  }

  return <BirthdayCarouselClient days={carouselDays} variant={variant} />;
}
