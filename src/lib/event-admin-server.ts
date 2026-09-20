import "server-only";

import { canManageEvent, hasEventAdminAccess, hasScopedEventAdminAccess } from "@/lib/event-admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export async function getEventAdminScope(userId: string) {
  const service = getSupabaseServiceClient();
  const [{ data: profile }, { data: assignments }] = await Promise.all([
    service
      .from("member_profiles")
      .select("is_admin,can_manage_events,approval_status")
      .eq("user_id", userId)
      .maybeSingle(),
    service.from("event_admin_members").select("event_id").eq("user_id", userId),
  ]);
  const eventIds = (assignments ?? []).map((item) => item.event_id);

  return {
    service,
    profile,
    eventIds,
    globalAccess: hasEventAdminAccess(profile),
    hasAccess: hasScopedEventAdminAccess(profile, eventIds),
    canManage: (eventId: string) => canManageEvent(profile, eventIds, eventId),
  };
}
