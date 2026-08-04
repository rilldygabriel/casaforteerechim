"use client";

import Link from "next/link";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addTestimonialComment, deleteTestimonialComment, toggleTestimonialLike } from "@/app/testemunhos/actions";

export type TestimonialComment = { id: string; user_id: string; author_name: string; body: string; created_at: string };

function SubmitButton({ children, label }: { children: React.ReactNode; label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" aria-label={label} disabled={pending}>{pending ? "Aguarde…" : children}</button>;
}

export default function TestimonialInteractions({ testimonialId, currentUserId, liked, likeCount, comments }: {
  testimonialId: string;
  currentUserId: string | null;
  liked: boolean;
  likeCount: number;
  comments: TestimonialComment[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  async function commentAction(formData: FormData) {
    await addTestimonialComment(formData);
    formRef.current?.reset();
  }
  return <div className="testimonial-interactions">
    <div className="testimonial-reactions">
      {currentUserId ? <form action={toggleTestimonialLike}>
        <input type="hidden" name="testimonialId" value={testimonialId} />
        <SubmitButton label={liked ? "Remover curtida" : "Curtir testemunho"}><span aria-hidden="true">{liked ? "♥" : "♡"}</span> {liked ? "Curtiu" : "Curtir"} · {likeCount}</SubmitButton>
      </form> : <Link href="/familia/login?next=/#testemunhos"><span aria-hidden="true">♡</span> Curtir · {likeCount}</Link>}
      <span>{comments.length} comentário{comments.length === 1 ? "" : "s"}</span>
    </div>
    <details className="testimonial-comments">
      <summary>Ver comentários</summary>
      <div className="testimonial-comment-list">
        {comments.length ? comments.map((comment) => <article key={comment.id}>
          <div><strong>{comment.author_name}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(comment.created_at))}</time></div>
          <p>{comment.body}</p>
          {comment.user_id === currentUserId ? <form action={deleteTestimonialComment}><input type="hidden" name="commentId" value={comment.id} /><SubmitButton>Excluir</SubmitButton></form> : null}
        </article>) : <p className="testimonial-comments-empty">Seja a primeira pessoa a comentar.</p>}
      </div>
      {currentUserId ? <form className="testimonial-comment-form" action={commentAction} ref={formRef}>
        <input type="hidden" name="testimonialId" value={testimonialId} />
        <textarea name="body" required maxLength={800} rows={3} placeholder="Escreva seu comentário…" aria-label="Comentário" />
        <SubmitButton>Comentar</SubmitButton>
      </form> : <Link className="testimonial-login-link" href="/familia/login?next=/#testemunhos">Entre na Área da Família para comentar</Link>}
    </details>
  </div>;
}
