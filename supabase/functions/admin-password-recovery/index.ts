import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.4";

const ADMIN_EMAIL = "ragrilldy@gmail.com";
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

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

function jsonResponse(ok: boolean, status: number) {
  return new Response(JSON.stringify({ ok }), {
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

function buildRecoveryEmail(recoveryUrl: string) {
  const text = [
    "Olá, Pastor Rilldy.",
    "",
    "Recebemos uma solicitação para redefinir a senha do Painel da Casa.",
    `Crie sua nova senha neste link: ${recoveryUrl}`,
    "",
    "Se você não solicitou esta alteração, ignore este e-mail.",
    "Igreja Casa Forte",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311">
        <p style="margin:0 0 12px;color:#fffe15;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Igreja Casa Forte</p>
        <h1 style="margin:0 0 16px;font-size:32px;line-height:1.1">Redefina sua senha</h1>
        <p style="margin:0 0 24px;color:#c7cac5;line-height:1.6">Olá, Pastor Rilldy. Recebemos uma solicitação para redefinir a senha do Painel da Casa.</p>
        <a href="${recoveryUrl}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Criar nova senha</a>
        <p style="margin:24px 0 0;color:#8f948e;font-size:13px;line-height:1.5">Se você não solicitou esta alteração, ignore este e-mail.</p>
      </div>
    </div>
  `;

  return { text, html };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(false, 405);
  }

  const oidcToken = getBearerToken(request);

  if (!oidcToken) {
    return jsonResponse(false, 401);
  }

  try {
    if (!(await verifyVercelIdentity(oidcToken))) {
      return jsonResponse(false, 403);
    }
  } catch {
    return jsonResponse(false, 401);
  }

  const requestId = request.headers.get("x-request-id") ?? "";
  const resendApiKey = request.headers.get("x-resend-api-key") ?? "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(requestId) ||
    !resendApiKey.startsWith("re_")
  ) {
    return jsonResponse(false, 400);
  }

  let email = "";

  try {
    const body = await request.json() as { email?: unknown };
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return jsonResponse(false, 400);
  }

  if (email !== ADMIN_EMAIL) {
    return jsonResponse(false, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();

  if (!supabaseUrl || !supabaseSecret) {
    console.error("admin_recovery_config_error", { requestId });
    return jsonResponse(false, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profile, error: profileError } = await supabase
    .from("member_profiles")
    .select("user_id,email,is_admin")
    .eq("email", ADMIN_EMAIL)
    .eq("is_admin", true)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("admin_recovery_profile_error", { requestId });
    return jsonResponse(false, 403);
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_admin_recovery",
    {
      p_email: ADMIN_EMAIL,
      p_interval_seconds: 60,
    },
  );

  if (claimError) {
    console.error("admin_recovery_rate_limit_error", { requestId });
    return jsonResponse(false, 500);
  }

  if (claimed !== true) {
    return jsonResponse(false, 429);
  }

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "recovery",
      email: ADMIN_EMAIL,
    });

  const hashedToken = linkData?.properties?.hashed_token;
  const userId = linkData?.user?.id;

  if (
    linkError ||
    typeof hashedToken !== "string" ||
    hashedToken.length === 0 ||
    userId !== profile.user_id
  ) {
    console.error("admin_recovery_link_error", { requestId });
    return jsonResponse(false, 500);
  }

  const recoveryUrl =
    `${SITE_ORIGIN}/admin/redefinir-senha#token_hash=` +
    `${encodeURIComponent(hashedToken)}&type=recovery`;
  const emailContent = buildRecoveryEmail(recoveryUrl);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `cf-admin-recovery-${requestId}`,
    },
    body: JSON.stringify({
      from: SENDER,
      to: [ADMIN_EMAIL],
      subject: "Redefina sua senha — Igreja Casa Forte",
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
    // O status HTTP é suficiente para tratar a falha sem expor a resposta.
  }

  if (!resendResponse.ok || !resendMessageId) {
    console.error("admin_recovery_email_error", {
      requestId,
      status: resendResponse.status,
    });
    return jsonResponse(false, 502);
  }

  console.log("admin_recovery_email_sent", {
    requestId,
    resendMessageId,
  });

  return jsonResponse(true, 200);
});
