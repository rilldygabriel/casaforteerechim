import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.4";

const VERCEL_OWNER = "rilldy-gabriel";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT = "casaforteerechim";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";
const VERCEL_ENVIRONMENT = "production";
const VERCEL_ISSUER = `https://oidc.vercel.com/${VERCEL_OWNER}`;
const VERCEL_AUDIENCE = `https://vercel.com/${VERCEL_OWNER}`;
const VERCEL_SUBJECT =
  `owner:${VERCEL_OWNER}:project:${VERCEL_PROJECT}:environment:${VERCEL_ENVIRONMENT}`;

const PROFILE_PHOTOS_BUCKET = "member-profile-photos";
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

function jsonResponse(
  status: number,
  body: Record<string, boolean | string>,
) {
  return new Response(JSON.stringify(body), {
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

function isMemberPhotoPath(memberId: string, path: string) {
  const [folder, fileName, ...extraSegments] = path.split("/");

  return (
    extraSegments.length === 0 &&
    folder === memberId &&
    PHOTO_FILE_PATTERN.test(fileName ?? "")
  );
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      code: "method_not_allowed",
    });
  }

  const oidcToken = getBearerToken(request);

  if (!oidcToken) {
    return jsonResponse(401, {
      ok: false,
      code: "missing_identity",
    });
  }

  try {
    if (!(await verifyVercelIdentity(oidcToken))) {
      return jsonResponse(403, {
        ok: false,
        code: "invalid_identity",
      });
    }
  } catch {
    return jsonResponse(401, {
      ok: false,
      code: "invalid_identity",
    });
  }

  const requestId = request.headers.get("x-request-id") ?? "";
  let adminUserId = "";
  let memberId = "";

  try {
    const body = await request.json() as {
      adminUserId?: unknown;
      memberId?: unknown;
    };

    adminUserId =
      typeof body.adminUserId === "string" ? body.adminUserId : "";
    memberId = typeof body.memberId === "string" ? body.memberId : "";
  } catch {
    return jsonResponse(400, {
      ok: false,
      code: "invalid_request",
    });
  }

  if (
    !UUID_PATTERN.test(requestId) ||
    !UUID_PATTERN.test(adminUserId) ||
    !UUID_PATTERN.test(memberId)
  ) {
    return jsonResponse(400, {
      ok: false,
      code: "invalid_request",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();

  if (!supabaseUrl || !supabaseSecret) {
    console.error("admin_member_photo_config_error", { requestId });
    return jsonResponse(500, {
      ok: false,
      code: "config_error",
    });
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
    return jsonResponse(403, {
      ok: false,
      code: "not_admin",
    });
  }

  const { data: member, error: memberError } = await supabase
    .from("member_profiles")
    .select("photo_url")
    .eq("user_id", memberId)
    .maybeSingle();

  if (memberError || !member) {
    return jsonResponse(404, {
      ok: false,
      code: "member_not_found",
    });
  }

  if (
    typeof member.photo_url !== "string" ||
    !isMemberPhotoPath(memberId, member.photo_url)
  ) {
    return jsonResponse(404, {
      ok: false,
      code: "photo_not_found",
    });
  }

  const { data: signedPhoto, error: signedPhotoError } =
    await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .createSignedUrl(member.photo_url, SIGNED_URL_TTL_SECONDS);

  if (signedPhotoError || !signedPhoto?.signedUrl) {
    console.error("admin_member_photo_sign_error", {
      requestId,
      memberId,
    });
    return jsonResponse(502, {
      ok: false,
      code: "photo_unavailable",
    });
  }

  return jsonResponse(200, {
    ok: true,
    signedUrl: signedPhoto.signedUrl,
  });
});
