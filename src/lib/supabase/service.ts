import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function getSupabaseServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(getSupabaseConfig().url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
