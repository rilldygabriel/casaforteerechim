import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { getSupabaseServiceClient } from "@/lib/supabase/service";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const DRAFT_BUCKET = "casa-event-drafts";
const PUBLIC_BUCKET = "casa-event-images";

export async function saveOwnerEventPhoto(mediaId: string, businessPhoneNumberId: string) {
  if (!/^\d{8,25}$/.test(mediaId)) throw new Error("Foto sem identificador válido.");
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("WhatsApp oficial sem token de mídia.");
  const metadataResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?phone_number_id=${businessPhoneNumberId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!metadataResponse.ok) throw new Error(`A Meta não liberou a foto (${metadataResponse.status}).`);
  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!metadata.url || !["image/jpeg", "image/png", "image/webp"].includes(metadata.mime_type ?? "") ||
      Number(metadata.file_size ?? 0) > MAX_MEDIA_BYTES) throw new Error("Envie uma foto JPG, PNG ou WebP de até 8 MB.");
  const url = new URL(metadata.url);
  if (url.protocol !== "https:" || !["lookaside.fbsbx.com", "graph.facebook.com"].includes(url.hostname)) {
    throw new Error("Endereço da foto da Meta inesperado.");
  }
  const imageResponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error",
    cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!imageResponse.ok || Number(imageResponse.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES) {
    throw new Error("Não consegui baixar a foto da Meta.");
  }
  const input = Buffer.from(await imageResponse.arrayBuffer());
  if (!input.length || input.length > MAX_MEDIA_BYTES) throw new Error("A foto está vazia ou acima de 8 MB.");
  let output: Buffer;
  try {
    output = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
  } catch { throw new Error("Não consegui ler essa foto. Envie outra imagem."); }
  if (!output.length || output.length > 5 * 1024 * 1024) throw new Error("A foto ficou grande demais para o evento.");
  const path = `whatsapp/${randomUUID()}.webp`;
  const { error } = await getSupabaseServiceClient().storage.from(DRAFT_BUCKET).upload(path, output, {
    contentType: "image/webp", upsert: false, cacheControl: "3600",
  });
  if (error) throw new Error("Não consegui guardar a foto com segurança. Tente novamente.");
  return path;
}

export async function recentOwnerEventPhoto(conversationId: number) {
  const service = getSupabaseServiceClient();
  const [{ data, error }, { data: drafts, error: draftError }] = await Promise.all([
    service.from("whatsapp_messages").select("id,created_at,raw_payload").eq("conversation_id", conversationId)
      .eq("direction", "inbound").eq("message_type", "image").order("created_at", { ascending: false }).limit(12),
    service.from("whatsapp_messages").select("raw_payload").eq("conversation_id", conversationId)
      .eq("message_type", "command_draft").order("created_at", { ascending: false }).limit(30),
  ]);
  if (error || draftError) throw new Error("Não consegui verificar a última foto enviada.");
  const assigned = new Set((drafts ?? []).map((row) => {
    const payload = row.raw_payload as { payload?: { imageDraftPath?: string } } | null;
    return payload?.payload?.imageDraftPath;
  }).filter(Boolean));
  for (const row of data ?? []) {
    if (Date.now() - new Date(row.created_at).getTime() > 60 * 60_000) break;
    const payload = row.raw_payload as { casa_event_photo?: { path?: string; state?: string } } | null;
    const photo = payload?.casa_event_photo;
    if (photo?.state === "stored" && /^whatsapp\/[0-9a-f-]{36}\.webp$/.test(photo.path ?? "") && !assigned.has(photo.path)) {
      return { messageId: row.id as number, path: photo.path as string };
    }
  }
  return null;
}

export async function publishOwnerEventPhoto(draftPath: string, eventId: string) {
  if (!/^whatsapp\/[0-9a-f-]{36}\.webp$/.test(draftPath) || !/^[0-9a-f-]{36}$/.test(eventId)) {
    throw new Error("Caminho de foto inválido; evento não será publicado.");
  }
  const storage = getSupabaseServiceClient().storage;
  const { data, error: downloadError } = await storage.from(DRAFT_BUCKET).download(draftPath);
  if (downloadError || !data) throw new Error("A foto do rascunho não está mais disponível.");
  const bytes = Buffer.from(await data.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("A foto do evento está inválida.");
  const publicPath = `events/${eventId}.webp`;
  const { error: uploadError } = await storage.from(PUBLIC_BUCKET).upload(publicPath, bytes, {
    contentType: "image/webp", cacheControl: "31536000", upsert: true,
  });
  if (uploadError) throw new Error("Não consegui publicar a capa do evento.");
  return storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath).data.publicUrl;
}
