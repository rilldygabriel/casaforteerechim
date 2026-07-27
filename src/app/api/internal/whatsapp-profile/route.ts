import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATION_TOKEN_SHA256 =
  "050dea7edbe8f260d7e3054347712540c90a9b714da9c471ad72a76414fd49e6";
const TARGET_DISPLAY_NAME = "Casa Forte Erechim";
const GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";

type JsonObject = Record<string, unknown>;

class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: JsonObject,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Identidade do WhatsApp</title>
    <style>
      body{margin:0;background:#090909;color:#fff;font:16px/1.5 system-ui,sans-serif}
      main{max-width:680px;margin:8vh auto;padding:28px}
      section{border:1px solid #333;border-radius:24px;padding:28px;background:#121212}
      h1{margin-top:0}.accent{color:#f2ff38}
      label{display:block;margin:20px 0 8px;font-weight:700}
      input{box-sizing:border-box;width:100%;padding:14px;border:1px solid #555;border-radius:12px;background:#090909;color:#fff}
      button{margin-top:18px;border:0;border-radius:999px;padding:14px 22px;background:#f2ff38;color:#090909;font-weight:800;cursor:pointer}
      pre{overflow:auto;white-space:pre-wrap;word-break:break-word;background:#050505;border-radius:14px;padding:18px}
    </style>
  </head>
  <body><main><section>${body}</section></main></body>
</html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}

function isAuthorized(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return false;

  const supplied = Buffer.from(
    createHash("sha256").update(value).digest("hex"),
  );
  const expected = Buffer.from(OPERATION_TOKEN_SHA256);

  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

async function metaJson(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<JsonObject> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as JsonObject;

  if (!response.ok) {
    const apiError =
      typeof payload.error === "object" && payload.error
        ? (payload.error as JsonObject)
        : undefined;
    const message =
      typeof apiError?.message === "string"
        ? apiError.message
        : `Meta Graph API respondeu HTTP ${response.status}.`;

    throw new MetaApiError(message, response.status, apiError);
  }

  return payload;
}

async function getPhoneStatus(accessToken: string) {
  const fields = [
    "display_phone_number",
    "verified_name",
    "name_status",
    "new_display_name",
    "new_name_status",
    "quality_rating",
  ].join(",");

  return metaJson(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}?fields=${fields}`,
    accessToken,
  );
}

async function getBusinessProfile(accessToken: string) {
  return metaJson(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/whatsapp_business_profile?fields=about,description,profile_picture_url,websites,vertical`,
    accessToken,
  );
}

async function updateProfilePicture(accessToken: string) {
  let appId =
    process.env.WHATSAPP_APP_ID ||
    process.env.META_APP_ID ||
    process.env.FACEBOOK_APP_ID;

  if (!appId) {
    const debug = await metaJson(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token?input_token=${encodeURIComponent(accessToken)}`,
      accessToken,
    );
    const data =
      typeof debug.data === "object" && debug.data
        ? (debug.data as JsonObject)
        : undefined;
    appId = typeof data?.app_id === "string" ? data.app_id : undefined;
  }

  if (!appId) {
    throw new Error("A Meta não informou o App ID associado ao token.");
  }

  const logo = await readFile(
    path.join(process.cwd(), "public", "icons", "icon-512.png"),
  );
  const uploadSession = await metaJson(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads?file_length=${logo.byteLength}&file_type=image%2Fpng&file_name=casa-forte-erechim.png`,
    accessToken,
    { method: "POST" },
  );
  const uploadId =
    typeof uploadSession.id === "string" ? uploadSession.id : undefined;

  if (!uploadId) {
    throw new Error("A Meta não criou a sessão de upload da logo.");
  }

  const uploadResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${uploadId}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
        "content-type": "application/octet-stream",
      },
      body: logo,
      cache: "no-store",
    },
  );
  const uploadPayload = (await uploadResponse
    .json()
    .catch(() => ({}))) as JsonObject;

  if (!uploadResponse.ok || typeof uploadPayload.h !== "string") {
    const apiError =
      typeof uploadPayload.error === "object" && uploadPayload.error
        ? (uploadPayload.error as JsonObject)
        : undefined;
    throw new MetaApiError(
      typeof apiError?.message === "string"
        ? apiError.message
        : "A Meta não recebeu a imagem da logo.",
      uploadResponse.status,
      apiError,
    );
  }

  return metaJson(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/whatsapp_business_profile`,
    accessToken,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        profile_picture_handle: uploadPayload.h,
      }),
    },
  );
}

async function requestDisplayName(accessToken: string) {
  return metaJson(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}`,
    accessToken,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ new_display_name: TARGET_DISPLAY_NAME }),
    },
  );
}

function resultLine(ok: boolean, value: string) {
  return `${ok ? "✅" : "⚠️"} ${value}`;
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "Erro não identificado.";
}

export async function GET() {
  return html(`
    <p class="accent">OPERAÇÃO PROTEGIDA</p>
    <h1>Identidade do WhatsApp da Casa</h1>
    <p>Atualiza somente a foto empresarial e solicita à Meta o nome <strong>${TARGET_DISPLAY_NAME}</strong>. Nenhuma mensagem será enviada.</p>
    <form method="post">
      <label for="token">Token da operação</label>
      <input id="token" name="token" type="password" autocomplete="off" required />
      <button type="submit">Atualizar perfil</button>
    </form>
  `);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  if (!isAuthorized(formData.get("token"))) {
    return html("<h1>Acesso negado</h1><p>Token inválido.</p>", 403);
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return html(
      "<h1>Credencial indisponível</h1><p>O token da Meta não está configurado neste ambiente da Vercel.</p>",
      503,
    );
  }

  let before: JsonObject | undefined;
  let pictureUpdated = false;
  let nameRequested = false;
  let pictureError: string | undefined;
  let nameError: string | undefined;

  try {
    before = await getPhoneStatus(accessToken);
  } catch {
    // A leitura inicial ajuda na restauração, mas não bloqueia as alterações.
  }

  try {
    await updateProfilePicture(accessToken);
    pictureUpdated = true;
  } catch (error) {
    pictureError = safeError(error);
  }

  const activeName =
    typeof before?.verified_name === "string" ? before.verified_name : "";
  const pendingName =
    typeof before?.new_display_name === "string"
      ? before.new_display_name
      : "";

  if (
    activeName.localeCompare(TARGET_DISPLAY_NAME, "pt-BR", {
      sensitivity: "base",
    }) === 0 ||
    pendingName.localeCompare(TARGET_DISPLAY_NAME, "pt-BR", {
      sensitivity: "base",
    }) === 0
  ) {
    nameRequested = true;
  } else {
    try {
      await requestDisplayName(accessToken);
      nameRequested = true;
    } catch (error) {
      nameError = safeError(error);
    }
  }

  let afterPhone: JsonObject | undefined;
  let afterProfile: JsonObject | undefined;

  try {
    [afterPhone, afterProfile] = await Promise.all([
      getPhoneStatus(accessToken),
      getBusinessProfile(accessToken),
    ]);
  } catch {
    // O resultado das operações acima continua válido mesmo se a leitura atrasar.
  }

  const report = [
    resultLine(pictureUpdated, "Foto empresarial atualizada com a logo oficial."),
    pictureError ? `Detalhe da foto: ${pictureError}` : "",
    resultLine(
      nameRequested,
      `Nome “${TARGET_DISPLAY_NAME}” ativo ou enviado para análise da Meta.`,
    ),
    nameError ? `Detalhe do nome: ${nameError}` : "",
    "",
    `Número: ${String(afterPhone?.display_phone_number || before?.display_phone_number || "não informado")}`,
    `Nome ativo: ${String(afterPhone?.verified_name || before?.verified_name || "não informado")}`,
    `Status do nome: ${String(afterPhone?.new_name_status || afterPhone?.name_status || before?.new_name_status || before?.name_status || "não informado")}`,
    `Foto disponível: ${afterProfile?.data ? "sim" : pictureUpdated ? "atualização aceita" : "não confirmada"}`,
  ]
    .filter(Boolean)
    .join("\n");

  return html(`
    <p class="accent">RESULTADO</p>
    <h1>Identidade do WhatsApp</h1>
    <pre>${report.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>
  `);
}
