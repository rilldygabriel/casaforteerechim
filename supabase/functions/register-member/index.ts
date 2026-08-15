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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

type InviteType = "invite" | "recovery";
type GeneratedLinkData = {
  properties?: { hashed_token?: string };
  user?: { id?: string };
};

function jsonResponse(
  ok: boolean,
  status: number,
  code?: string,
  extra?: Record<string, unknown>,
) {
  return new Response(JSON.stringify({ ok, code, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function normalize(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

function getSupabaseSecret() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default.length > 0) {
        return parsed.default;
      }
    } catch {
      // Usa a chave legada do ambiente hospedado.
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

function buildInviteEmail(fullName: string, inviteUrl: string) {
  const safeName = fullName.replace(/[<>&"']/g, "");
  const text = [
    `Olá, ${safeName}.`,
    "",
    "Seu cadastro na Área da Família da Igreja Casa Forte foi realizado.",
    `Crie sua senha neste link: ${inviteUrl}`,
    "",
    "Este link é pessoal. Não encaminhe para outras pessoas.",
    "Igreja Casa Forte",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311">
        <p style="margin:0 0 12px;color:#fffe15;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Igreja Casa Forte</p>
        <h1 style="margin:0 0 16px;font-size:32px;line-height:1.1">Bem-vindo à Família</h1>
        <p style="margin:0 0 24px;color:#c7cac5;line-height:1.6">Olá, ${safeName}. Seu cadastro foi realizado. Crie sua senha para entrar na Área da Família.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Criar minha senha</a>
        <p style="margin:24px 0 0;color:#8f948e;font-size:13px;line-height:1.5">Este link é pessoal. Se você não fez este cadastro, ignore o e-mail.</p>
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

  let fullName = "";
  let email = "";
  let phone = "";
  let gender = "";
  let fingerprint = "";

  try {
    const body = await request.json() as Record<string, unknown>;
    fullName = normalize(body.fullName);
    email = normalize(body.email).toLowerCase();
    phone = normalize(body.phone);
    gender = normalize(body.gender).toLowerCase();
    fingerprint = normalize(body.fingerprint).toLowerCase();
  } catch {
    return jsonResponse(false, 400, "invalid_request");
  }

  const phoneDigits = phone.replace(/\D/g, "");
  if (
    fullName.length < 3 ||
    fullName.length > 160 ||
    email.length < 5 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    phone.length > 30 ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15 ||
    !["masculino", "feminino"].includes(gender) ||
    !FINGERPRINT_PATTERN.test(fingerprint)
  ) {
    return jsonResponse(false, 400, "invalid_request");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();
  if (!supabaseUrl || !supabaseSecret) {
    console.error("member_register_config_error", { requestId });
    return jsonResponse(false, 500, "config_error");
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from("member_applications")
    .select("id", { count: "exact", head: true })
    .eq("request_fingerprint", fingerprint)
    .gte("created_at", hourAgo);

  if (rateError) {
    console.error("member_register_rate_error", { requestId });
    return jsonResponse(false, 500, "database_error");
  }

  if ((recentCount ?? 0) >= 5) {
    return jsonResponse(false, 429, "rate_limited");
  }

  const { data: existingApplication, error: lookupError } = await supabase
    .from("member_applications")
    .select("id,full_name,email,phone,gender,status,auth_user_id,updated_at")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    return jsonResponse(false, 500, "database_error");
  }

  if (existingApplication?.status === "rejected") {
    return jsonResponse(true, 200, "already_registered");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let application = existingApplication;

  if (!application) {
    const { data, error } = await supabase
      .from("member_applications")
      .insert({
        full_name: fullName,
        email,
        phone,
        gender,
        status: "pending",
        request_fingerprint: fingerprint,
      })
      .select("id,full_name,email,phone,gender,status,auth_user_id,updated_at")
      .single();

    if (error || !data) {
      console.error("member_register_insert_error", { requestId });
      return jsonResponse(false, 500, "database_error");
    }
    application = data;
  } else {
    const lastAttempt = Date.parse(application.updated_at);
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 60_000) {
      return jsonResponse(false, 429, "rate_limited");
    }

    const { data, error } = await supabase
      .from("member_applications")
      .update({
        full_name: fullName,
        phone,
        gender,
        request_fingerprint: fingerprint,
        updated_at: nowIso,
      })
      .eq("id", application.id)
      .select("id,full_name,email,phone,gender,status,auth_user_id,updated_at")
      .single();

    if (error || !data) {
      return jsonResponse(false, 500, "database_error");
    }
    application = data;
  }

  let inviteType: InviteType = application.auth_user_id
    ? "recovery"
    : "invite";
  let linkData: GeneratedLinkData | null = null;
  let linkError: unknown = null;

  if (inviteType === "recovery") {
    const result = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    linkData = result.data;
    linkError = result.error;
  } else {
    const result = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: fullName, phone, gender } },
    });
    linkData = result.data;
    linkError = result.error;

    if (linkError) {
      const { data: existingProfile } = await supabase
        .from("member_profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile?.user_id) {
        inviteType = "recovery";
        const recovery = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        linkData = recovery.data;
        linkError = recovery.error;
      }
    }
  }

  const hashedToken = linkData?.properties?.hashed_token;
  const authUserId = linkData?.user?.id;
  if (
    linkError ||
    !hashedToken ||
    !authUserId ||
    !UUID_PATTERN.test(authUserId)
  ) {
    console.error("member_register_link_error", {
      requestId,
      applicationId: application.id,
    });
    return jsonResponse(false, 502, "link_error");
  }

  const { error: claimError } = await supabase
    .from("member_applications")
    .update({ auth_user_id: authUserId, updated_at: nowIso })
    .eq("id", application.id);

  const { error: profileError } = await supabase
    .from("member_profiles")
    .update({
      full_name: fullName,
      phone,
      gender,
      is_admin: false,
      approval_status: "approved",
      church_status: "membro",
      approved_at: nowIso,
      approved_by: null,
      updated_at: nowIso,
    })
    .eq("user_id", authUserId);

  if (claimError || profileError) {
    console.error("member_register_profile_error", {
      requestId,
      applicationId: application.id,
    });
    return jsonResponse(false, 500, "database_error");
  }

  const inviteUrl =
    `${SITE_ORIGIN}/familia/aceitar-convite#token_hash=` +
    `${encodeURIComponent(hashedToken)}&type=${inviteType}`;
  const emailContent = buildInviteEmail(fullName, inviteUrl);
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key":
        `cf-member-auto-${application.id}-${Math.floor(Date.now() / 900000)}`,
    },
    body: JSON.stringify({
      from: SENDER,
      to: [email],
      subject: "Crie sua senha da Área da Família — Igreja Casa Forte",
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
    // O status HTTP trata a falha sem expor a resposta do provedor.
  }

  if (!resendResponse.ok || !resendMessageId) {
    console.error("member_register_email_error", {
      requestId,
      applicationId: application.id,
      status: resendResponse.status,
    });
    return jsonResponse(false, 502, "email_error");
  }

  const { error: finalizeError } = await supabase
    .from("member_applications")
    .update({
      status: "invited",
      auth_user_id: authUserId,
      reviewed_at: nowIso,
      reviewed_by: null,
      updated_at: nowIso,
    })
    .eq("id", application.id);

  if (finalizeError) {
    console.error("member_register_finalize_error", {
      requestId,
      applicationId: application.id,
      resendMessageId,
    });
    return jsonResponse(false, 500, "database_error");
  }

  console.log("member_registered", {
    requestId,
    applicationId: application.id,
    resendMessageId,
  });
  return jsonResponse(true, 201, "registered", { inviteUrl });
});
