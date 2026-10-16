"use client";
/* eslint-disable @next/next/no-img-element -- Private originals, lazy loaded without conversion. */
import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_TYPES, matchesMedia, mediaFilename, mediaSize, type MediaPost } from "@/lib/media-library";
import MediaUpload from "./media-upload";
import styles from "./media-library.module.css";

function download(url: string, filename?: string) { const link = document.createElement("a"); link.href = url; if (filename) link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
function downloadCaption(text: string) { const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); download(url, "legenda.txt"); setTimeout(() => URL.revokeObjectURL(url), 30000); }

export default function MediaLibrary() {
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [upload, setUpload] = useState(false);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("ready");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const response = await fetch("/api/media-library", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (current === generation.current) { setPosts(result.posts); setError(""); }
    } catch (error) { if (current === generation.current) setError(error instanceof Error ? error.message : "Não foi possível carregar os materiais."); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial network subscription; updates occur after the response.
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 30000);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  const visible = posts.filter(post => matchesMedia(post, query, kind, status));
  return <>
    <div className={styles.toolbar}><button className={styles.primary} onClick={() => setUpload(true)} disabled={upload}>+ Enviar material pronto</button><button className={styles.secondary} onClick={() => { setLoading(true); void load(); }} disabled={loading}>Atualizar lista</button></div>
    {upload && <MediaUpload onClose={() => setUpload(false)} onSaved={() => { setUpload(false); setNotice("Material salvo na biblioteca da Casa."); void load(); }} />}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.filters} aria-label="Filtros da biblioteca">
      <div className={styles.tabs} aria-label="Formato">{[["all", "Todos"], ["reel", "Reels"], ["image", "Posts estáticos"], ["carousel", "Carrosséis"]].map(([key, label]) => <button key={key} aria-pressed={kind === key} onClick={() => { setKind(key); setLimit(6); }}>{label} ({posts.filter(p => matchesMedia(p, query, key, status)).length})</button>)}</div>
      <div className={styles.tabs} aria-label="Status">{[["ready", "Prontos"], ["posted", "Já postados"], ["all", "Todos os status"]].map(([key, label]) => <button key={key} aria-pressed={status === key} onClick={() => { setStatus(key); setLimit(6); }}>{label} ({posts.filter(p => matchesMedia(p, query, kind, key)).length})</button>)}</div>
      <label className={styles.search}>Buscar por título ou legenda<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(6); }} placeholder="Qual material você procura?" /></label>
    </section>
    {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error} <button className={styles.secondary} onClick={() => void load()}>Tentar novamente</button></p>}
    <p role="status" className={styles.count}>{loading ? "Carregando materiais…" : `${visible.length} ${visible.length === 1 ? "postagem encontrada" : "postagens encontradas"}`}</p>
    {!loading && !error && visible.length === 0 && <div className={styles.empty}><h2>{posts.length ? "Nenhum material neste filtro" : "Seu próximo post começa aqui"}</h2><p>{posts.length ? "Altere o formato, o status ou a busca para encontrar outros materiais." : "Envie uma arte, um carrossel ou um Reel com capa e legenda para a equipe publicar."}</p></div>}
    <div className={styles.grid}>{visible.slice(0, limit).map(post => <MediaCard key={post.id} post={post} onChange={load} />)}</div>
    {limit < visible.length && <div className={styles.actions}><button className={styles.secondary} onClick={() => setLimit(v => v + 6)}>Mostrar mais materiais</button></div>}
    <p className={styles.hint}>Publicação manual: baixar, compartilhar ou copiar a legenda não publica nas redes e não altera o status. O histórico permanece disponível.</p>
  </>;
}

function MediaCard({ post, onChange }: { post: MediaPost; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [shareFiles, setShareFiles] = useState<File[]>([]);
  const fileUrl = (index: number) => `/api/media-library/${post.id}/file?index=${index}`;
  async function run(task: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(false); setMessage("");
    try { await task(); } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente."); }
    finally { guard.current = false; setBusy(false); }
  }
  const images = post.assets.map((asset, index) => ({ asset, index })).filter(({ asset }) => asset.role !== "video");
  async function preparePhotos() {
    setShareFiles([]);
    if (!navigator.canShare || !navigator.share) { setMessage("Este navegador não compartilha arquivos. Baixe os originais ou o ZIP e importe as imagens pelo aplicativo Arquivos."); return; }
    if (images.reduce((sum, { asset }) => sum + asset.size, 0) > 150 * 1024 ** 2) { setMessage("Este material é grande para compartilhar de uma vez no celular. Use os downloads individuais ou o ZIP e importe pelo aplicativo Arquivos."); return; }
    const files: File[] = [];
    for (const { asset, index } of images) {
      setMessage(`Preparando foto ${files.length + 1} de ${images.length}…`);
      const response = await fetch(fileUrl(index), { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível preparar as fotos. Tente novamente ou baixe os originais.");
      const blob = await response.blob();
      if (blob.size !== asset.size) throw new Error("Uma imagem não chegou completa. Tente novamente.");
      files.push(new File([blob], mediaFilename(asset, index), { type: asset.mime }));
    }
    if (!navigator.canShare({ files })) { setMessage("O aparelho não aceita esse conjunto de arquivos no compartilhamento. Use o ZIP ou os originais e importe pelo aplicativo Arquivos."); return; }
    setShareFiles(files); setMessage("Fotos preparadas. Toque em Compartilhar fotos. No iPhone, escolha Salvar imagens, se disponível, e conclua a ação no aparelho.");
  }
  return <article className={styles.card}>
    <span className={styles.type}>{MEDIA_TYPES[post.kind]} · {post.assets.length} {post.assets.length === 1 ? "arquivo" : "arquivos"}</span>
    <h2>{post.title}</h2>
    <div className={styles.status}><span>{post.posted ? "Já postado" : "Pronto para publicação manual"}</span><label className={styles.check}><input type="checkbox" checked={post.posted} disabled={busy} onChange={e => { const posted = e.target.checked; void run(async () => { const response = await fetch(`/api/media-library/${post.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", posted }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await onChange(); setMessage(posted ? "Marcado como já postado." : "Material voltou para Prontos."); }); }} />Já postado</label></div>
    <p className={styles.caption}>{post.caption || "Sem legenda."}</p>
    <div className={styles.actions}>
      <button className={styles.secondary} disabled={busy} onClick={() => void run(async () => { if (!navigator.clipboard) throw new Error("Este navegador não permite copiar automaticamente. Selecione a legenda acima para copiá-la."); await navigator.clipboard.writeText(post.caption); setMessage("Legenda copiada."); })}>Copiar legenda</button>
      <button className={styles.secondary} onClick={() => downloadCaption(post.caption)}>Baixar legenda</button>
    </div>
    <div className={`${styles.previews} ${post.kind === "image" ? styles.single : ""}`}>{post.assets.map((asset, index) => <figure className={styles.asset} key={asset.path}>
      {asset.role === "video" ? <video controls playsInline preload="none" src={fileUrl(index)} poster={fileUrl(1)} aria-label={`Vídeo: ${post.title}`}><a href={`${fileUrl(index)}&download=1`}>Baixar vídeo original</a></video> : <img src={fileUrl(index)} alt={`${asset.role === "slide" ? `Slide ${index + 1}` : asset.role === "cover" ? "Capa do Reel" : "Arte"}: ${post.title}`} loading="lazy" decoding="async" />}
      <figcaption><span>{asset.role === "slide" ? `Slide ${index + 1}` : asset.role === "video" ? "Vídeo final" : asset.role === "cover" ? "Capa do Reel" : "Arte final"}</span><span>{mediaSize(asset.size)}</span></figcaption>
      <a className={styles.download} href={`${fileUrl(index)}&download=1`}>Baixar original</a>
    </figure>)}</div>
    <div className={styles.actions}>
      <button className={styles.primary} disabled={busy} onClick={() => void run(async () => { setMessage(`Verificando ${post.assets.length} arquivos para o ZIP…`); const response = await fetch(`/api/media-library/${post.id}/zip?prepare=1`); const result = await response.json(); if (!response.ok) throw new Error(result.error); download(`/api/media-library/${post.id}/zip`); setMessage(`Download do ZIP iniciado: ${result.files} arquivos e legenda.txt. Acompanhe a conclusão nos downloads do navegador. Se interromper, tente novamente ou use os originais.`); })}>Baixar tudo em ZIP</button>
      <button className={styles.secondary} disabled={busy} onClick={() => void run(preparePhotos)}>Preparar fotos para salvar no aparelho</button>
    </div>
    {shareFiles.length > 0 && <button className={styles.primary} disabled={busy} onClick={() => { void navigator.share({ files: shareFiles }).then(() => { setShareFiles([]); setMessage("Compartilhamento concluído. Confira no aparelho se você escolheu e concluiu o salvamento das imagens."); }).catch(e => { setMessage(e?.name === "AbortError" ? "Compartilhamento cancelado. As imagens continuam disponíveis." : "Não foi possível compartilhar. Use os downloads individuais ou o ZIP."); }); }}>Compartilhar fotos</button>}
    {message && <p role={error ? "alert" : "status"} className={`${styles.notice} ${error ? styles.error : ""}`}>{message}</p>}
  </article>;
}
