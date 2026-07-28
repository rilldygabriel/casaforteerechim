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

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jwks = createRemoteJWKSet(
  new URL("https://oidc.vercel.com/.well-known/jwks"),
);

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
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

async function getMemberUserIds(
  supabase: ReturnType<typeof createClient>,
) {
  const memberUserIds = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("member_profiles")
      .select("user_id")
      .order("user_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const profile of data ?? []) {
      if (
        typeof profile.user_id === "string" &&
        UUID_PATTERN.test(profile.user_id)
      ) {
        memberUserIds.add(profile.user_id);
      }
    }

    if (!data || data.length < PAGE_SIZE) {
      return memberUserIds;
    }
  }

  throw new Error("member_page_limit");
}

async function getMemberVerification(
  supabase: ReturnType<typeof createClient>,
  memberUserIds: Set<string>,
) {
  let emailAuthenticatedMembers = 0;
  const memberVerification: Array<{
    userId: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  }> = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users) {
      if (memberUserIds.has(user.id) && !user.deleted_at) {
        const emailVerified =
          typeof user.email_confirmed_at === "string";
        const phoneVerified =
          typeof user.phone_confirmed_at === "string";

        if (emailVerified) {
          emailAuthenticatedMembers += 1;
        }

        memberVerification.push({
          userId: user.id,
          emailVerified,
          phoneVerified,
        });
      }
    }

    if (data.users.length < PAGE_SIZE) {
      return {
        emailAuthenticatedMembers,
        memberVerification,
      };
    }
  }

  throw new Error("auth_page_limit");
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

  try {
    const body = await request.json() as {
      adminUserId?: unknown;
    };

    adminUserId =
      typeof body.adminUserId === "string" ? body.adminUserId : "";
  } catch {
    return jsonResponse(400, {
      ok: false,
      code: "invalid_request",
    });
  }

  if (
    !UUID_PATTERN.test(requestId) ||
    !UUID_PATTERN.test(adminUserId)
  ) {
    return jsonResponse(400, {
      ok: false,
      code: "invalid_request",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseSecret = getSupabaseSecret();

  if (!supabaseUrl || !supabaseSecret) {
    console.error("admin_member_stats_config_error", { requestId });
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

  try {
    const memberUserIds = await getMemberUserIds(supabase);
    const {
      emailAuthenticatedMembers,
      memberVerification,
    } = await getMemberVerification(supabase, memberUserIds);

    return jsonResponse(200, {
      ok: true,
      registeredMembers: memberUserIds.size,
      emailAuthenticatedMembers,
      memberVerification,
    });
  } catch {
    console.error("admin_member_stats_query_error", { requestId });
    return jsonResponse(502, {
      ok: false,
      code: "stats_unavailable",
    });
  }
});
