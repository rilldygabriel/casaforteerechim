export const WOMENS_ENCOUNTER_SLUG = "encontro-com-deus-mulheres-2026";
export const CASH_REGISTRATION_OWNER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

export function canCreateCashRegistration(userId: string, slug: string, manualAccess: boolean) {
  return manualAccess && (slug !== WOMENS_ENCOUNTER_SLUG || userId === CASH_REGISTRATION_OWNER_ID);
}
