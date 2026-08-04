import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deleteTestimonial, saveTestimonial } from "@/app/testemunhos/actions";

export const metadata = { title: "Meus testemunhos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MyTestimonialsPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login?next=/familia/testemunhos");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) redirect("/familia");
  const { data: testimonials } = await supabase.from("testimonials").select("id,title,body,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false });
  const { editar } = await searchParams;
  const editing = (testimonials ?? []).find((item) => item.id === editar);
  return <main className="family-testimonials-page">
    <header className="inner-header"><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link className="inner-back" href="/familia">Voltar à Família</Link></header>
    <section className="family-testimonials-hero"><p className="section-eyebrow"><span aria-hidden="true" />Minha história com Deus</p><h1>Testemunhos</h1><p>Conte o que Deus fez na sua vida. Seu testemunho aparecerá na página inicial da Casa.</p></section>
    <section className="family-testimonials-layout">
      <article className="testimonial-editor"><p className="home-kicker">{editing ? "Editar testemunho" : "Novo testemunho"}</p><h2>{editing ? "Atualize sua história" : "Compartilhe sua história"}</h2>
        <form action={saveTestimonial}>{editing ? <input type="hidden" name="testimonialId" value={editing.id} /> : null}
          <label>Título<input name="title" required minLength={3} maxLength={120} defaultValue={editing?.title ?? ""} placeholder="Ex.: Deus restaurou minha família" /></label>
          <label>Seu testemunho<textarea name="body" required minLength={10} maxLength={3000} rows={9} defaultValue={editing?.body ?? ""} placeholder="Conte com suas palavras o que aconteceu…" /></label>
          <div><button type="submit">{editing ? "Salvar alterações" : "Publicar testemunho"}</button>{editing ? <Link href="/familia/testemunhos">Cancelar edição</Link> : null}</div>
        </form>
      </article>
      <aside className="my-testimonials"><p className="home-kicker">Meus testemunhos</p><h2>Publicados</h2>
        {testimonials?.length ? testimonials.map((item) => <article key={item.id}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(item.created_at))}</time><h3>{item.title}</h3><p>{item.body}</p><div><Link href={`/familia/testemunhos?editar=${item.id}`}>Editar</Link><form action={deleteTestimonial}><input type="hidden" name="testimonialId" value={item.id} /><button type="submit">Excluir</button></form></div></article>) : <p className="my-testimonials-empty">Você ainda não publicou nenhum testemunho.</p>}
      </aside>
    </section>
  </main>;
}
