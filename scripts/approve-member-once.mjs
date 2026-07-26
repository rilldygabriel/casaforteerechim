import { randomUUID } from "node:crypto";
import { getVercelOidcToken } from "@vercel/oidc";

const APPLICATION_ID = 2;
const ADMIN_USER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";
const TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";
const APPROVAL_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/approve-member-application";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Aprovação operacional ignorada fora de produção.");
  process.exit(0);
}

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey?.startsWith("re_")) {
  throw new Error("Credencial segura de e-mail indisponível.");
}

const oidcToken = await getVercelOidcToken({
  team: TEAM_ID,
  project: PROJECT_ID,
  expirationBufferMs: 10_000,
});

const response = await fetch(APPROVAL_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${oidcToken}`,
    "Content-Type": "application/json",
    "x-request-id": randomUUID(),
    "x-resend-api-key": resendApiKey,
  },
  body: JSON.stringify({
    applicationId: APPLICATION_ID,
    adminUserId: ADMIN_USER_ID,
  }),
});

const result = await response.json().catch(() => ({}));

if (
  !response.ok ||
  !["invited", "already_invited"].includes(result.code)
) {
  throw new Error(
    `A aprovação protegida falhou com status ${response.status}.`,
  );
}

console.log(
  `Solicitação ${APPLICATION_ID} concluída: ${result.code}.`,
);
