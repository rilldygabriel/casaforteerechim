"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addFamilyAnnouncementComment, deleteFamilyAnnouncementComment, toggleFamilyAnnouncementLike } from "./actions";

export type AnnouncementComment = { id: string; user_id: string; author_name: string; body: string; created_at: string };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Aguarde…" : children}</button>;
}

export default function AnnouncementInteractions({ announcementId, userId, liked, likeCount, comments }: { announcementId: string; userId: string; liked: boolean; likeCount: number; comments: AnnouncementComment[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  async function commentAction(formData: FormData) {
    await addFamilyAnnouncementComment(formData);
    formRef.current?.reset();
  }

  return <div className="family-announcement-interactions">
    <div className="family-announcement-reactions">
      <form action={toggleFamilyAnnouncementLike}><input type="hidden" name="announcementId" value={announcementId} /><SubmitButton>{liked ? "♥ Curtiu" : "♡ Curtir"} · {likeCount}</SubmitButton></form>
      <span>{comments.length} comentário{comments.length === 1 ? "" : "s"}</span>
    </div>
    <details className="family-announcement-comments">
      <summary>Ver e comentar</summary>
      <div className="family-comment-list">
        {comments.length ? comments.map((comment) => <article key={comment.id}>
          <div><strong>{comment.author_name}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.created_at))}</time></div>
          <p>{comment.body}</p>
          {comment.user_id === userId ? <form action={deleteFamilyAnnouncementComment}><input type="hidden" name="commentId" value={comment.id} /><SubmitButton>Excluir</SubmitButton></form> : null}
        </article>) : <p className="family-comments-empty">Seja a primeira pessoa a comentar.</p>}
      </div>
      <form className="family-comment-form" action={commentAction} ref={formRef}>
        <input type="hidden" name="announcementId" value={announcementId} />
        <textarea name="body" required maxLength={800} rows={3} placeholder="Escreva seu comentário…" />
        <SubmitButton>Comentar</SubmitButton>
      </form>
    </details>
  </div>;
}
