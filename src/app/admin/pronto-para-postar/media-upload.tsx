"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { MEDIA_BUCKET, mediaSize, normalizeUpload, type MediaAsset, type MediaKind } from "@/lib/media-library";
import styles from "./media-library.module.css";

export default function MediaUpload({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<MediaKind>("carousel");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const id = useRef<string | null>(null);
  const guard = useRef(false);
  useEffect(() => {
    if (!busy) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [busy]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      id.current ||= crypto.randomUUID();
      const files = kind === "reel" ? [video, cover].filter((file): file is File => !!file) : images;
      const value = normalizeUpload({ id: id.current, title, caption, kind, files: files.map(f => ({ name: f.name, size: f.size, mime: f.type })) });
      setStarted(true); setMessage("Preparando envio seguro…");
      const response = await fetch("/api/media-library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!result.ready) {
        const { Upload } = await import("tus-js-client");
        const { url, publishableKey } = getSupabaseConfig();
        const endpoint = new URL(url); endpoint.hostname = endpoint.hostname.replace(".supabase.co", ".storage.supabase.co");
        for (let i = 0; i < files.length; i++) {
          const upload: MediaAsset & { token?: string; complete: boolean } = result.uploads[i];
          setMessage(`Enviando ${i + 1} de ${files.length}: ${files[i].name}. Mantenha a página aberta.`);
          setProgress(i / files.length * 100);
          if (!upload.complete) await new Promise<void>((resolve, reject) => {
            const task = new Upload(files[i], {
              endpoint: `${endpoint.origin}/storage/v1/upload/resumable`,
              headers: { "x-signature": upload.token!, apikey: publishableKey },
              chunkSize: 6 * 1024 * 1024,
              retryDelays: [0, 3000, 5000, 10000, 20000],
              uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
              fingerprint: async () => `casa-media-${upload.path}-${files[i].size}-${files[i].lastModified}`,
              metadata: { bucketName: MEDIA_BUCKET, objectName: upload.path, contentType: upload.mime, cacheControl: "3600" },
              onProgress: (sent, total) => setProgress((i + sent / total) / files.length * 100),
              onError: () => reject(new Error(`Não foi possível enviar ${files[i].name}. Confira sua conexão e toque em Tentar novamente.`)),
              onSuccess: () => resolve(),
            });
            void task.findPreviousUploads().then(previous => { if (previous[0]) task.resumeFromPreviousUpload(previous[0]); task.start(); }).catch(reject);
          });
        }
        setProgress(100); setMessage("Conferindo os arquivos e salvando o material…");
        const complete = await fetch(`/api/media-library/${result.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
        const completed = await complete.json();
        if (!complete.ok) throw new Error(completed.error);
      }
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Falha no envio. Tente novamente."); setMessage(""); }
    finally { setBusy(false); guard.current = false; }
  }
  return <form className={styles.form} onSubmit={submit} aria-label="Enviar material pronto">
    <header><h2>Enviar material pronto</h2><button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Fechar</button></header>
    <fieldset disabled={busy || started}>
      <label>Tipo<select value={kind} onChange={e => { setKind(e.target.value as MediaKind); setImages([]); setVideo(null); setCover(null); }}><option value="carousel">Carrossel</option><option value="image">Imagem única</option><option value="reel">Reel + capa</option></select></label>
      <label>Título para organizar<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required /></label>
      {kind === "reel" ? <>
        <label>Vídeo final (MP4 ou MOV)<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={e => setVideo(e.target.files?.[0] || null)} required /></label>
        <label>Capa do Reel<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={e => setCover(e.target.files?.[0] || null)} required /></label>
      </> : <label>{kind === "carousel" ? "Imagens do carrossel" : "Arte final"}<input key={kind} type="file" multiple={kind === "carousel"} accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={e => { const selected = Array.from(e.target.files || []); setImages(previous => kind === "carousel" ? [...previous, ...selected] : selected.slice(0, 1)); e.target.value = ""; }} /></label>}
      <p className={styles.hint}>Originais preservados. Até 5 GB por arquivo. Em carrosséis, a ordem abaixo será usada nas prévias e no ZIP (até 200 imagens).</p>
      {images.length > 0 && <ol className={styles.selected}>{images.map((file, i) => <li key={`${file.name}-${i}`}><span>{i + 1}. {file.name} · {mediaSize(file.size)}</span><button type="button" disabled={i === 0} aria-label={`Mover ${file.name} para cima`} onClick={() => setImages(previous => { const list = [...previous]; [list[i - 1], list[i]] = [list[i], list[i - 1]]; return list; })}>↑</button><button type="button" aria-label={`Remover ${file.name}`} onClick={() => setImages(previous => previous.filter((_, index) => index !== i))}>×</button></li>)}</ol>}
      <label>Legenda pronta para copiar<textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={30000} placeholder="Texto completo, hashtags e quebras de linha…" /></label>
    </fieldset>
    {message && <div role="status" className={styles.notice}>{message}<progress value={progress} max={100} aria-label="Progresso do envio" /></div>}
    {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
    <div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Enviando…" : started ? "Tentar novamente" : "Salvar em Pronto para postar"}</button></div>
    {started && !busy && <p className={styles.hint}>Para manter a integridade do envio, os campos estão bloqueados. Você pode tentar novamente sem duplicar o material ou fechar para iniciar outro envio.</p>}
  </form>;
}
