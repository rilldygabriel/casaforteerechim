-- The profile form always sends gender, but its original migration omitted
-- the column-level UPDATE grant. Keep existing owner/approval RLS unchanged.
-- Never grant table-wide UPDATE or use service_role to bypass self-edit RLS.
grant update (gender) on public.member_profiles to authenticated;
