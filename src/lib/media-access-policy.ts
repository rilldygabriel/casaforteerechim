export const MEDIA_ACCESS_OWNER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

type MediaAccessProfile = { is_admin?: boolean; approval_status?: string } | null;

export function canRevokeMediaAccess(userId: string, profile: MediaAccessProfile) {
  return userId === MEDIA_ACCESS_OWNER_ID && profile?.is_admin === true && profile.approval_status === "approved";
}

export function canManageMediaAccess(userId: string, profile: MediaAccessProfile, hasActiveMediaMembership = false) {
  return canRevokeMediaAccess(userId, profile) || (profile?.approval_status === "approved" && hasActiveMediaMembership === true);
}

export function parseMediaAccessChange(value: unknown): { memberId: string; enabled: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.memberId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.memberId) || typeof body.enabled !== "boolean") return null;
  return { memberId: body.memberId, enabled: body.enabled };
}

export type MediaAccessMember = {
  user_id: string;
  full_name: string | null;
  approval_status: string;
  is_admin: boolean;
  media_enabled: boolean;
};
