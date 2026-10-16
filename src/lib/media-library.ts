export const MEDIA_BUCKET = "casa-ready-media";
export const MAX_MEDIA_BYTES = 5 * 1024 ** 3;
export type MediaKind = "carousel" | "image" | "reel";
export type MediaAsset = { path: string; name: string; mime: string; size: number; role: "slide" | "image" | "video" | "cover" };
export type MediaPost = { id: string; title: string; caption: string; kind: MediaKind; assets: MediaAsset[]; posted: boolean; posted_at: string | null; created_at: string; created_by: string; state: "uploading" | "ready" };
export const MEDIA_TYPES: Record<MediaKind, string> = { carousel: "Carrossel", image: "Post estático", reel: "Reel" };
const IMAGE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime" };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUpload(input: unknown) {
  const value = input as { id?: unknown; title?: unknown; caption?: unknown; kind?: unknown; files?: unknown };
  if (!value || typeof value.id !== "string" || !UUID.test(value.id)) throw new Error("Identificador inválido. Reabra o formulário.");
  if (typeof value.title !== "string" || !value.title.trim() || value.title.trim().length > 160) throw new Error("Informe um título com até 160 caracteres.");
  if (typeof value.caption !== "string" || value.caption.length > 30000) throw new Error("A legenda pode ter até 30.000 caracteres.");
  if (!["carousel", "image", "reel"].includes(String(value.kind))) throw new Error("Escolha o tipo de material.");
  const kind = value.kind as MediaKind;
  if (!Array.isArray(value.files) || !value.files.length || value.files.length > 200) throw new Error("Selecione entre 1 e 200 arquivos.");
  if ((kind === "image" && value.files.length !== 1) || (kind === "reel" && value.files.length !== 2)) throw new Error("Envie uma arte ou, para Reel, um vídeo e uma capa.");
  const files = value.files.map((file: { name?: unknown; size?: unknown; mime?: unknown }, index) => {
    if (!file || typeof file.name !== "string" || file.name.length > 255 || /[\x00-\x1f/\\]/.test(file.name)) throw new Error("Nome de arquivo inválido.");
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const video = kind === "reel" && index === 0;
    const mime = (video ? VIDEO_TYPES : IMAGE_TYPES)[extension];
    if (!mime || (file.mime && file.mime !== mime)) throw new Error(video ? "O vídeo deve ser MP4 ou MOV." : "As imagens devem ser JPG, PNG ou WebP.");
    if (typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_MEDIA_BYTES) throw new Error("Cada arquivo deve ter conteúdo e no máximo 5 GB.");
    const role: MediaAsset["role"] = kind === "carousel" ? "slide" : kind === "image" ? "image" : video ? "video" : "cover";
    return { name: file.name, size: file.size, mime, role, extension };
  });
  return { id: value.id, title: value.title.trim(), caption: value.caption, kind, files };
}

export function mediaFilename(asset: MediaAsset, index: number) {
  const extension = asset.name.split(".").pop()!.toLowerCase();
  return asset.role === "slide" ? `${String(index + 1).padStart(2, "0")}-slide.${extension}` : `${asset.role === "video" ? "video-final" : asset.role === "cover" ? "capa" : "arte"}.${extension}`;
}

export function mediaSize(size: number) {
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(2)} GB`;
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function matchesMedia(post: MediaPost, query: string, kind: string, status: string) {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return (kind === "all" || kind === post.kind) && (status === "all" || post.posted === (status === "posted")) && normalize(`${post.title}\n${post.caption}`).includes(normalize(query.trim()));
}
