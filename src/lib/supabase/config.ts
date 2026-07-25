const FALLBACK_SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const FALLBACK_SUPABASE_KEY =
  "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";

export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      FALLBACK_SUPABASE_KEY,
  };
}
