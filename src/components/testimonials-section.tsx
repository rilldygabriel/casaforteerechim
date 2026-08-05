import Image from "next/image";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import TestimonialInteractions, { type TestimonialComment } from "./testimonial-interactions";
import TestimonialExcerpt from "./testimonial-excerpt";

export default async function TestimonialsSection() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: testimonials }, { data: likes }, { data: comments }] = await Promise.all([
    supabase.from("testimonials").select("id,user_id,author_name,author_photo_path,title,body,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("testimonial_likes").select("testimonial_id,user_id").limit(2000),
    supabase.from("testimonial_comments").select("id,testimonial_id,user_id,author_name,body,created_at").order("created_at", { ascending: true }).limit(2000),
  ]);
  if (!testimonials?.length) return <section className="home-block home-testimonials" id="testemunhos">
    <div className="home-section-heading"><p className="home-kicker">O que Deus tem feito</p><h2>Testemunhos da Casa</h2><p>Histórias reais de fé, cuidado e transformação.</p></div>
    <div className="testimonial-empty"><p>O primeiro testemunho pode ser o seu.</p><Link href="/familia/testemunhos">Compartilhar meu testemunho</Link></div>
  </section>;

  const photoPaths = [...new Set(testimonials.map((item) => item.author_photo_path).filter(Boolean))] as string[];
  const photoMap = new Map<string, string>();
  if (photoPaths.length) {
    const { data } = await getSupabaseServiceClient().storage.from("member-profile-photos").createSignedUrls(photoPaths, 3600);
    data?.forEach((item) => { if (item.path && item.signedUrl) photoMap.set(item.path, item.signedUrl); });
  }

  return <section className="home-block home-testimonials" id="testemunhos">
    <div className="home-section-heading home-section-heading-row"><div><p className="home-kicker">O que Deus tem feito</p><h2>Testemunhos da Casa</h2></div><Link href="/familia/testemunhos">Compartilhar o meu</Link></div>
    <div className="testimonial-grid">{testimonials.map((item) => {
      const itemLikes = (likes ?? []).filter((like) => like.testimonial_id === item.id);
      const itemComments = (comments ?? []).filter((comment) => comment.testimonial_id === item.id) as TestimonialComment[];
      const photo = item.author_photo_path ? photoMap.get(item.author_photo_path) : null;
      return <article className="testimonial-card" key={item.id}>
        <header>{photo ? <Image src={photo} alt={`Foto de ${item.author_name}`} width={52} height={52} /> : <span aria-hidden="true">{item.author_name.slice(0, 1).toUpperCase()}</span>}<div><strong>{item.author_name}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</time></div></header>
        <h3>{item.title}</h3><TestimonialExcerpt>{item.body}</TestimonialExcerpt>
        <TestimonialInteractions testimonialId={item.id} currentUserId={user?.id ?? null} liked={itemLikes.some((like) => like.user_id === user?.id)} likeCount={itemLikes.length} comments={itemComments} />
      </article>;
    })}</div>
  </section>;
}
