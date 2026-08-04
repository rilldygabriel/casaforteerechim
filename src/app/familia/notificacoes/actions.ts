"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function markAllFamilyAnnouncementsRead() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: announcements } = await supabase.from("family_announcements").select("id").limit(200);
  if (!announcements?.length) return;
  await supabase.from("family_announcement_reads").upsert(
    announcements.map((item) => ({ announcement_id: item.id, user_id: user.id, read_at: new Date().toISOString() })),
    { onConflict: "announcement_id,user_id" },
  );
  revalidatePath("/familia");
  revalidatePath("/familia/notificacoes");
}
