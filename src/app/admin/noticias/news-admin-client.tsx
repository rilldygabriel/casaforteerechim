"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { NewsPost } from "@/lib/news";
import styles from "./news-admin.module.css";

type EditorImage = {
  key: string;
  url: string;
  path: string | null;
  file?: File;
};

function imagesFromPost(post: NewsPost | null): EditorImage[] {
  return (post?.news_images ?? []).map((image) => ({
    key: image.id ?? image.image_url,
    url: image.image_url,
    path: image.storage_path,
  }));
}

export default function NewsAdminClient({ initialPosts }: { initialPosts: NewsPost[] }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => posts.find((post) => post.id === selectedId) ?? null,
    [posts, selectedId],
  );

  return (
    <section className={styles.layout}>
      <NewsEditor
        key={selected?.id ?? "new"}
        post={selected}
        onSaved={(saved) => {
          if (selected) {
            setPosts((current) => current.map((post) => (post.id === selected.id ? { ...post, ...saved } : post)));
          } else {
            router.push(`/noticias/${saved.slug}`);
          }
        }}
        onCancel={selected ? () => setSelectedId(null) : undefined}
      />
      <aside className={styles.history}>
        <header>
          <span>Publicadas</span>
          <h2>Editar notícia</h2>
        </header>
        {!posts.length ? <p>Nenhuma notícia publicada ainda.</p> : posts.map((post) => (
          <button type="button" key={post.id} onClick={() => setSelectedId(post.id)} data-active={selectedId === post.id}>
            <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(post.published_at))}</time>
            <strong>{post.title}</strong>
            <span>Editar publicação →</span>
          </button>
        ))}
      </aside>
    </section>
  );
}

function NewsEditor({ post, onSaved, onCancel }: { post: NewsPost | null; onSaved: (post: Partial<NewsPost> & { slug: string }) => void; onCancel?: () => void }) {
  const initialImages = imagesFromPost(post);
  const initialCover = Math.max(0, (post?.news_images ?? []).findIndex((image) => image.is_cover));
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [images, setImages] = useState<EditorImage[]>(initialImages);
  const [coverIndex, setCoverIndex] = useState(initialCover);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = 5 - images.length;
    const additions = Array.from(files).slice(0, room).map((file) => ({
      key: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      url: URL.createObjectURL(file),
      path: null,
      file,
    }));
    setImages((current) => [...current, ...additions]);
  }

  function removeImage(index: number) {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCoverIndex((current) => {
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  }

  async function uploadImage(image: EditorImage) {
    if (!image.file) return { url: image.url, path: image.path };
    const response = await fetch("/api/admin/noticias/imagens", {
      method: "POST",
      headers: { "Content-Type": image.file.type || "image/jpeg" },
      body: image.file,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Não foi possível enviar uma foto.");
    return payload as { url: string; path: string };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    if (!images.length) {
      setFeedback("Adicione ao menos uma foto para a notícia.");
      return;
    }
    setPending(true);
    try {
      const uploaded = [];
      for (const image of images) uploaded.push(await uploadImage(image));
      const endpoint = post ? `/api/admin/noticias/${post.id}` : "/api/admin/noticias";
      const response = await fetch(endpoint, {
        method: post ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, images: uploaded, coverIndex }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a notícia.");
      setFeedback(post ? "Notícia atualizada com sucesso." : `Notícia publicada. ${payload.pushSent ?? 0} aparelho(s) receberam o aviso agora.`);
      onSaved({ id: post?.id, title, body, slug: payload.slug, updated_at: new Date().toISOString() });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar a notícia.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className={styles.editor}>
      <header>
        <span>{post ? "Edição" : "Nova publicação"}</span>
        <h2>{post ? "Editar notícia" : "Criar nova notícia"}</h2>
      </header>
      <form onSubmit={submit}>
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={140} required placeholder="Título da notícia" />
        </label>
        <label>
          Texto da notícia
          <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={3} maxLength={2000} rows={12} required placeholder="Escreva a notícia. Links inseridos no texto ficarão clicáveis." />
          <small>{body.length}/2000 caracteres</small>
        </label>
        <div className={styles.photoField}>
          <div><strong>Fotos</strong><span>Até 5 fotos · escolha uma como capa</span></div>
          {images.length < 5 ? <label className={styles.fileButton}>Carregar fotos<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => addFiles(event.target.files)} /></label> : null}
        </div>
        {images.length ? <div className={styles.photoGrid}>{images.map((image, index) => (
          <article key={image.key} data-cover={coverIndex === index}>
            <Image src={image.url} alt={`Prévia da foto ${index + 1}`} fill unoptimized sizes="(max-width: 720px) 45vw, 180px" />
            <label><input type="radio" name="cover" checked={coverIndex === index} onChange={() => setCoverIndex(index)} />Capa</label>
            <button type="button" onClick={() => removeImage(index)} aria-label={`Remover foto ${index + 1}`}>×</button>
          </article>
        ))}</div> : null}
        <div className={styles.actions}>
          <button type="submit" disabled={pending}>{pending ? "Salvando…" : post ? "Salvar alterações" : "Publicar e notificar"}</button>
          {onCancel ? <button type="button" onClick={onCancel}>Cancelar edição</button> : null}
        </div>
        {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}
      </form>
    </article>
  );
}
