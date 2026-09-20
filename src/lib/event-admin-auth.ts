export type EventAdminProfile = {
  is_admin?: boolean | null;
  can_manage_events?: boolean | null;
  can_sell_manual_tickets?: boolean | null;
  approval_status?: string | null;
};

export function hasManualTicketSalesAccess(profile: EventAdminProfile | null | undefined) {
  return Boolean(
    profile?.approval_status === "approved" && profile.can_sell_manual_tickets === true,
  );
}

export function hasEventAdminAccess(profile: EventAdminProfile | null | undefined) {
  return Boolean(
    profile?.approval_status === "approved" &&
      (profile.is_admin === true || profile.can_manage_events === true),
  );
}

export function hasScopedEventAdminAccess(
  profile: EventAdminProfile | null | undefined,
  assignedEventIds: readonly string[],
) {
  return Boolean(
    profile?.approval_status === "approved" &&
      (hasEventAdminAccess(profile) || assignedEventIds.length > 0),
  );
}

export function canManageEvent(
  profile: EventAdminProfile | null | undefined,
  assignedEventIds: readonly string[],
  eventId: string,
) {
  return Boolean(
    profile?.approval_status === "approved" &&
      (hasEventAdminAccess(profile) || assignedEventIds.includes(eventId)),
  );
}
