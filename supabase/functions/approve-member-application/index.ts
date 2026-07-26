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

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

type InviteType = "invite" | "recovery";
type GeneratedLinkData = {
  properties?: {
    hashed_token?: string;
  };
  user?: {
    id?: string;
  };
};

function jsonResponse(ok: boolean, status: number, code?: string) {
  return new Response(JSON.stringify({ ok, code }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
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
      // Usa a chave legada disponível no ambiente hospedado.
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
    "Seu acesso à Área da Família da Igreja Casa Forte foi aprovado.",
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
        <p style="margin:0 0 24px;color:#c7cac5;line-height:1.6">Olá, ${safeName}. Seu acesso foi aprovado. Crie sua senha para entrar na Área da Família.</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Criar minha senha</a>
        <p style="margin:24px 0 0;color:#8f948e;font-size:13px;line-height:1.5">Este link é pessoal. Se você não solicitou este acesso, ignore o e-mail.</p>
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

  if (
    !UUID_PATTERN.test(requestId) ||
    !resendApiKey.startsWith("re_")
  ) {
    return jsonResponse(false, 400, "invalid_request");
  }

  let applicationId = 0;
  let adminUserId = "";

  try {
    const body = await request.json() as {
      applicationId?: unknown;
      adminUserId?: unknown;
    };
    applicationId =
      typeof body.applicationId === "number" &&
        Number.isSafeInteger(body.applicationId)
        ? body.applicationId
        : 0;
    adminUserId =
      typeof body.adminUserId === "string" ? body.adminUserId : "";
  } catch {
    return jsonResponse(false, 400, "invalid_request");
  }

  if (applicationId < 1 || !UUID_PATTERN.test(adminUserId)) {
    return jsonResponse(false, 400, "invalid_request");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();

  if (!supabaseUrl || !supabaseSecret) {
    console.error("member_invite_config_error", { requestId });
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
    .select("user_id,is_admin,approval_status")
    .eq("user_id", adminUserId)
    .eq("is_admin", true)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (adminError || !adminProfile) {
    return jsonResponse(false, 403, "not_admin");
  }

  const { data: application, error: applicationError } = await supabase
    .from("member_applications")
    .select(
      "id,full_name,email,phone,status,auth_user_id,reviewed_by",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    return jsonResponse(false, 404, "application_not_found");
  }

  if (application.status === "invited" && application.auth_user_id) {
    return jsonResponse(true, 200, "already_invited");
  }

  let inviteType: InviteType = "invite";
  let linkData: GeneratedLinkData | null = null;
  let linkError: unknown = null;

  if (application.auth_user_id) {
    inviteType = "recovery";
    const result = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: application.email,
    });
    linkData = result.data;
    linkError = result.error;
  } else {
    const result = await supabase.auth.admin.generateLink({
      type: "invite",
      email: application.email,
      options: {
        data: {
          full_name: application.full_name,
          phone: application.phone,
        },
      },
    });
    linkData = result.data;
    linkError = result.error;

    if (linkError) {
      const { data: existingProfile } = await supabase
        .from("member_profiles")
        .select("user_id")
        .eq("email", application.email)
        .maybeSingle();

      if (!existingProfile?.user_id) {
        console.error("member_invite_link_error", {
          requestId,
          applicationId,
        });
        return jsonResponse(false, 502, "link_error");
      }

      inviteType = "recovery";
      const recoveryResult = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: application.email,
      });
      linkData = recoveryResult.data;
      linkError = recoveryResult.error;
    }
  }

  const hashedToken = linkData?.properties?.hashed_token;
  const authUserId = linkData?.user?.id;

  if (
    linkError ||
    typeof hashedToken !== "string" ||
    hashedToken.length === 0 ||
    typeof authUserId !== "string" ||
    !UUID_PATTERN.test(authUserId)
  ) {
    console.error("member_invite_link_error", {
      requestId,
      applicationId,
    });
    return jsonResponse(false, 502, "link_error");
  }

  if (!application.auth_user_id) {
    const { error: claimError } = await supabase
      .from("member_applications")
      .update({
        auth_user_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (claimError) {
      console.error("member_invite_claim_error", {
        requestId,
        applicationId,
      });
      return jsonResponse(false, 500, "database_error");
    }
  }

  const inviteUrl =
    `${SITE_ORIGIN}/familia/aceitar-convite#token_hash=` +
    `${encodeURIComponent(hashedToken)}&type=${inviteType}`;
  const emailContent = buildInviteEmail(application.full_name, inviteUrl);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `cf-member-invite-${applicationId}`,
    },
    body: JSON.stringify({
      from: SENDER,
      to: [application.email],
      subject: "Seu acesso à Família foi aprovado — Igreja Casa Forte",
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
    console.error("member_invite_email_error", {
      requestId,
      applicationId,
      status: resendResponse.status,
    });
    return jsonResponse(false, 502, "email_error");
  }

  const now = new Date().toISOString();
  const { error: profileUpdateError } = await supabase
    .from("member_profiles")
    .update({
      full_name: application.full_name,
      phone: application.phone,
      approval_status: "approved",
      church_status: "membro",
      approved_at: now,
      approved_by: adminUserId,
      updated_at: now,
    })
    .eq("user_id", authUserId);

  const { error: applicationUpdateError } = await supabase
    .from("member_applications")
    .update({
      status: "invited",
      auth_user_id: authUserId,
      reviewed_at: now,
      reviewed_by: adminUserId,
      updated_at: now,
    })
    .eq("id", applicationId);

  if (profileUpdateError || applicationUpdateError) {
    console.error("member_invite_finalize_error", {
      requestId,
      applicationId,
      resendMessageId,
    });
    return jsonResponse(false, 500, "database_error");
  }

  console.log("member_invite_sent", {
    requestId,
    applicationId,
    resendMessageId,
  });

  return jsonResponse(true, 200, "invited");
});
