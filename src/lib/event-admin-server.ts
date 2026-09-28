import "server-only";

import { hasEventAdminAccess, hasManualTicketSalesAccess } from "@/lib/event-admin-auth";
import { isMinistryPastor } from "@/lib/ministry-event-policy";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export async function getEventAdminScope(userId: string) {
  const service = getSupabaseServiceClient();
  const [profileResult, assignmentResult, leaderResult] = await Promise.all([
    service
      .from("member_profiles")
      .select("is_admin,can_manage_events,can_sell_manual_tickets,approval_status")
      .eq("user_id", userId)
      .maybeSingle(),
    service.from("event_admin_members").select("event_id").eq("user_id", userId),
    service.from("ministry_leaders").select("ministry_key").eq("member_id", userId),
  ]);
  if(profileResult.error||assignmentResult.error||leaderResult.error)throw new Error("Não foi possível conferir suas permissões.");
  const profile=profileResult.data,approved=profile?.approval_status==="approved";
  const assignments=new Set((assignmentResult.data??[]).map(row=>row.event_id));
  const keys=new Set((leaderResult.data??[]).map(row=>row.ministry_key));
  const eventIds:string[]=[],legacyEventIds:string[]=[];
  for(let from=0;;from+=1000){
    const {data,error}=await service.from("events").select("id,ministry_key").order("id").range(from,from+999);
    if(error)throw new Error("Não foi possível conferir os eventos.");
    for(const event of data??[]){
      const allowed=approved&&(event.ministry_key?(isMinistryPastor(userId)||keys.has(event.ministry_key)):(hasEventAdminAccess(profile)||assignments.has(event.id)));
      if(allowed){eventIds.push(event.id);if(!event.ministry_key)legacyEventIds.push(event.id);}
    }
    if((data?.length??0)<1000)break;
  }

  return {
    service,
    profile,
    eventIds,
    legacyEventIds,
    globalAccess: hasEventAdminAccess(profile),
    manualTicketAccess: hasManualTicketSalesAccess(profile),
    hasAccess: approved && (hasEventAdminAccess(profile)||eventIds.length>0),
    canManage: (eventId: string) => eventIds.includes(eventId),
    canManageLegacy: (eventId: string) => legacyEventIds.includes(eventId),
  };
}
