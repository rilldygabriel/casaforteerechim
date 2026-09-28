import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MINISTRIES } from "@/app/familia/servir/ministries";

export async function ministryFundAccess() {
  const db=await getSupabaseServerClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) return null;
  const [profile,leaders]=await Promise.all([
    db.from("member_profiles").select("is_admin,approval_status").eq("user_id",user.id).maybeSingle(),
    db.from("ministry_leaders").select("ministry_key").eq("member_id",user.id),
  ]);
  if(profile.error||leaders.error) throw new Error("Não foi possível verificar suas permissões. Tente novamente.");
  if(!profile.data || (!profile.data.is_admin && profile.data.approval_status!=="approved")) return null;
  const isAdmin=Boolean(profile.data.is_admin);
  const keys=new Set((leaders.data??[]).map(row=>row.ministry_key));
  const ministries=MINISTRIES.filter(m=>isAdmin||keys.has(m.key)).map(({key,label})=>({key,label}));
  return ministries.length?{db,user,isAdmin,ministries}:null;
}
