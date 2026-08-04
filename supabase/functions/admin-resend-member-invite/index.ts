import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.4";

const SITE_ORIGIN = "https://www.casaforteerechim.app.br";
const SENDER = "Igreja Casa Forte <no-reply@auth.casaforteerechim.app.br>";

const VERCEL_OWNER = "rilldy-gabriel";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT = "casaforteerechim";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";
const VERCEL_ENVIRONMENT = "production";
const VERCEL_ISSUER = `https://oidc.vercel.com/${VERCEL_OWNER}`;
const VERCEL_AUDIENCE = `https://vercel.com/${VERCEL_OWNER}`;
const VERCEL_SUBJECT =
  `owner:${VERCEL_OWNER}:project:${VERCEL_PROJECT}:environment:${VERCEL_ENVIRONMENT}`;

const RESEND_COOLDOWN_MS = 60_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

type GeneratedLinkData = {
  properties?: {
    hashed_token?: string;
  };
  user?: {
    id?: string;
  };
};

function jsonResponse(ok: boolean, status: number, code: string) {
  return new Response(JSON.stringify({ ok, code }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getSupabaseSecret() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;

      if (typeof defaultKey === "string" && defaultKey.length > 0) {
        return defaultKey;
      }
    } catch {
      // Usa a chave legada disponível somente dentro da Edge Function.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  return scheme === "Bearer" && token ? token : "";
}

async function verifyVercelIdentity(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: VERCEL_ISSUER,
    audience: VERCEL_AUDIENCE,
    subject: VERCEL_SUBJECT,
    algorithms: ["RS256"],
    clockTolerance: 5,
  });

  return (
    payload.owner === VERCEL_OWNER &&
    payload.owner_id === VERCEL_TEAM_ID &&
    payload.project === VERCEL_PROJECT &&
    payload.project_id === VERCEL_PROJECT_ID &&
    payload.environment === VERCEL_ENVIRONMENT
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function buildResendEmail(fullName: string, inviteUrl: string) {
  const firstName = fullName.trim().split(/\s+/)[0] || "irmão";
  const safeName = escapeHtml(firstName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const text = [
    `Olá, ${firstName}.`,
    "",
    "Você solicitou um novo link de acesso à Área da Família da Igreja Casa Forte.",
    `Defina sua senha neste link: ${inviteUrl}`,
    "",
    "Este novo link é pessoal. Não encaminhe para outras pessoas.",
    "Igreja Casa Forte",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311">
        <p style="margin:0 0 12px;color:#fffe15;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Igreja Casa Forte</p>
        <h1 style="margin:0 0 16px;font-size:32px;line-height:1.1">Novo link de acesso</h1>
        <p style="margin:0 0 24px;color:#c7cac5;line-height:1.6">Olá, ${safeName}. Use o novo link abaixo para definir sua senha e entrar na Área da Família.</p>
        <a href="${safeInviteUrl}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Acessar Área da Família</a>
        <p style="margin:24px 0 0;color:#8f948e;font-size:13px;line-height:1.5">Este link é pessoal. Se você não solicitou um novo acesso, ignore este e-mail.</p>
      </div>
    </div>
  `;

  return { text, html };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(false, 405, "method_not_allowed");
  }

  const oidcToken = getBearerToken(request);

  if (!oidcToken) {
    return jsonResponse(false, 401, "missing_identity");
  }

  try {
    if (!(await verifyVercelIdentity(oidcToken))) {
      return jsonResponse(false, 403, "invalid_identity");
    }
  } catch {
    return jsonResponse(false, 401, "invalid_identity");
  }

  const requestId = request.headers.get("x-request-id") ?? "";
  const resendApiKey = request.headers.get("x-resend-api-key") ?? "";

  if (!UUID_PATTERN.test(requestId) || !resendApiKey.startsWith("re_")) {
    return jsonResponse(false, 400, "invalid_request");
  }

  let memberId = "";
  let adminUserId = "";

  try {
    const body = await request.json() as {
      memberId?: unknown;
      adminUserId?: unknown;
    };
    memberId = typeof body.memberId === "string" ? body.memberId : "";
    adminUserId =
      typeof body.adminUserId === "string" ? body.adminUserId : "";
  } catch {
    return jsonResponse(false, 400, "invalid_request");
  }

  if (
    !UUID_PATTERN.test(memberId) ||
    !UUID_PATTERN.test(adminUserId) ||
    memberId === adminUserId
  ) {
    return jsonResponse(false, 400, "invalid_request");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();

  if (!supabaseUrl || !supabaseSecret) {
    console.error("member_invite_resend_config_error", { requestId });
    return jsonResponse(false, 500, "config_error");
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: adminProfile, error: adminError } = await supabase
    .from("member_profiles")
    .select("user_id")
    .eq("user_id", adminUserId)
    .eq("is_admin", true)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (adminError || !adminProfile) {
    return jsonResponse(false, 403, "not_admin");
  }

  const { data: member, error: memberError } = await supabase
    .from("member_profiles")
    .select("user_id,full_name,email,is_admin,approval_status")
    .eq("user_id", memberId)
    .maybeSingle();

  if (
    memberError ||
    !member ||
    member.is_admin ||
    member.approval_status !== "approved" ||
    typeof member.email !== "string" ||
    !EMAIL_PATTERN.test(member.email)
  ) {
    return jsonResponse(false, 404, "member_not_eligible");
  }

  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(memberId);
  const authUser = authData?.user;

  if (
    authError ||
    !authUser ||
    authUser.deleted_at ||
    authUser.email?.toLowerCase() !== member.email.toLowerCase()
  ) {
    return jsonResponse(false, 409, "auth_user_mismatch");
  }

  const { data: application, error: applicationError } = await supabase
    .from("member_applications")
    .select("id,status,updated_at")
    .eq("auth_user_id", memberId)
    .maybeSingle();

  if (
    applicationError ||
    !application ||
    !["approved", "invited"].includes(application.status)
  ) {
    return jsonResponse(false, 404, "application_not_found");
  }

  const now = new Date();
  const cooldownCutoff = new Date(
    now.getTime() - RESEND_COOLDOWN_MS,
  ).toISOString();
  const { data: claimedApplication, error: claimError } = await supabase
    .from("member_applications")
    .update({ updated_at: now.toISOString() })
    .eq("id", application.id)
    .lt("updated_at", cooldownCutoff)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("member_invite_resend_claim_error", {
      requestId,
      applicationId: application.id,
    });
    return jsonResponse(false, 500, "database_error");
  }

  if (!claimedApplication) {
    return jsonResponse(false, 429, "rate_limited");
  }

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email: member.email,
    });
  const generatedLink = linkData as GeneratedLinkData | null;
  const hashedToken = generatedLink?.properties?.hashed_token;
  const generatedUserId = generatedLink?.user?.id;

  if (
    linkError ||
    typeof hashedToken !== "string" ||
    hashedToken.length === 0 ||
    generatedUserId !== memberId
  ) {
    console.error("member_invite_resend_link_error", {
      requestId,
      applicationId: application.id,
    });
    return jsonResponse(false, 502, "link_error");
  }

  const inviteUrl =
    `${SITE_ORIGIN}/familia/aceitar-convite#token_hash=` +
    `${encodeURIComponent(hashedToken)}&type=recovery`;
  const emailContent = buildResendEmail(
    typeof member.full_name === "string" ? member.full_name : "Irmão",
    inviteUrl,
  );
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key":
        `cf-member-resend-${application.id}-${Math.floor(now.getTime() / RESEND_COOLDOWN_MS)}`,
    },
    body: JSON.stringify({
      from: SENDER,
      to: [member.email],
      subject: "Novo link da Área da Família — Igreja Casa Forte",
      text: emailContent.text,
      html: emailContent.html,
    }),
  });

  let resendMessageId = "";

  try {
    const resendData = await resendResponse.json() as { id?: unknown };
    resendMessageId =
      typeof resendData.id === "string" ? resendData.id : "";
  } catch {
    // O status HTTP basta para tratar a falha sem expor a resposta.
  }

  if (!resendResponse.ok || !resendMessageId) {
    console.error("member_invite_resend_email_error", {
      requestId,
      applicationId: application.id,
      status: resendResponse.status,
    });
    return jsonResponse(false, 502, "email_error");
  }

  console.info("member_invite_resent", {
    requestId,
    applicationId: application.id,
    resendMessageId,
  });

  return jsonResponse(true, 200, "resent");
});
