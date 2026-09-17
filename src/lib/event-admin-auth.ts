export type EventAdminProfile = {
  is_admin?: boolean | null;
  can_manage_events?: boolean | null;
  approval_status?: string | null;
};

export function hasEventAdminAccess(profile: EventAdminProfile | null | undefined) {
  return Boolean(
    profile?.approval_status === "approved" &&
      (profile.is_admin === true || profile.can_manage_events === true),
  );
}
