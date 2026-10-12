export const WOMENS_ENCOUNTER_SLUG = "encontro-com-deus-mulheres-2026";
export const CASH_REGISTRATION_OWNER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

// Keep in sync with public.event_contact_participant_key. A shared contact
// must never make one woman's checkout resume another woman's payment.
export function eventContactParticipantKey(slug: string, fullName: string) {
  return slug === WOMENS_ENCOUNTER_SLUG
    ? fullName.trim().replace(/\s+/g, " ").toLowerCase()
    : null;
}

export function canCreateCashRegistration(userId: string, slug: string, manualAccess: boolean) {
  return manualAccess && (slug !== WOMENS_ENCOUNTER_SLUG || userId === CASH_REGISTRATION_OWNER_ID);
}
