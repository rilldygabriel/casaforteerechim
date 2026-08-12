import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ATTENDANCE_OPTIONS, EVENT_STATUSES, REGISTRATION_STATUSES, eventRegistrationState, optionLabel } from "@/lib/events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { archiveEvent, archiveRegistration, saveEvent, saveRegistration } from "./actions";

export const metadata = { title: "Eventos e Inscrições | Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Search = { tab?: string; evento?: string; status?: string; busca?: string; ordem?: string; editar?: string; mensagem?: string };
type EventRow = {
  id: string; title: string; slug: string; description: string; category: string; start_date: string; end_date: string | null;
  start_time: string | null; end_time: string | null; location: string; image_url: string | null; status: string;
  registration_enabled: boolean; registration_status: string; registration_deadline: string | null; capacity: number | null;
  registration_fee_cents: number;
  is_public: boolean; is_featured: boolean;
};
type RegistrationRow = {
  id: string; event_id: string; full_name: string; email: string | null; phone: string; phone_normalized: string; attendance_duration: string;
  notes: string; status: string; completed_encounter: boolean | null; created_at: string; events: { id?: string; title: string; slug?: string } | null;
};

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const filters = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") redirect("/admin");

  const service = getSupabaseServiceClient();
  const [{ data: events }, { data: registrations }] = await Promise.all([
    service.from("events").select("*").is("archived_at", null).order("start_date", { ascending: true }),
    service.from("event_registrations").select("*,events(id,title,slug)").is("archived_at", null).order("created_at", { ascending: filters.ordem !== "antigas" }),
  ]);
  const allEvents = events ?? [];
  const allRegistrations = registrations ?? [];
  const filtered = allRegistrations.filter((item) => {
    const query = (filters.busca ?? "").toLowerCase().replace(/\D/g, "");
    const textQuery = (filters.busca ?? "").toLowerCase();
    return (!filters.evento || item.event_id === filters.evento) && (!filters.status || item.status === filters.status) && (!filters.busca || item.full_name.toLowerCase().includes(textQuery) || item.email?.toLowerCase().includes(textQuery) || item.phone_normalized.includes(query));
  });
  const editing = allEvents.find((item) => item.id === filters.editar);
  const activeEvents = allEvents.filter((item) => item.status !== "cancelled");
  const pending = allRegistrations.filter((item) => item.status === "pending").length;
  const confirmed = allRegistrations.filter((item) => item.status === "confirmed").length;

  return <main className="admin-events-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header>
    <section className="admin-events-hero"><p className="section-eyebrow"><span aria-hidden="true" />Organização da Casa</p><h1>Eventos e Inscrições</h1><p>Crie eventos, acompanhe participantes e organize cada próximo passo.</p></section>
    <section className="admin-event-summary"><article><span>Eventos ativos</span><strong>{activeEvents.length}</strong></article><article><span>Total de inscrições</span><strong>{allRegistrations.length}</strong></article><article><span>Pendentes</span><strong>{pending}</strong></article><article><span>Confirmadas</span><strong>{confirmed}</strong></article></section>
    {filters.mensagem ? <p className="admin-event-feedback" role="status">{filters.mensagem}</p> : null}
    <nav className="admin-event-tabs" aria-label="Seções"><Link data-active={filters.tab !== "inscricoes"} href="/admin/eventos?tab=eventos">Eventos</Link><Link data-active={filters.tab === "inscricoes"} href="/admin/eventos?tab=inscricoes">Inscrições</Link></nav>
    {filters.tab === "inscricoes" ? <RegistrationsTab events={allEvents} registrations={filtered} filters={filters} /> : <EventsTab events={allEvents} registrations={allRegistrations} editing={editing} />}
  </main>;
}

function EventsTab({ events, registrations, editing }: { events: EventRow[]; registrations: RegistrationRow[]; editing?: EventRow }) {
  return <section className="admin-events-layout"><article className="admin-event-editor"><p className="home-kicker">{editing ? "Editar evento" : "Novo evento"}</p><h2>{editing ? editing.title : "Criar evento"}</h2><form action={saveEvent}>{editing ? <input type="hidden" name="eventId" value={editing.id} /> : null}
    <label>Título<input name="title" required maxLength={160} defaultValue={editing?.title ?? ""} /></label><label>Endereço do evento<input name="slug" maxLength={180} defaultValue={editing?.slug ?? ""} placeholder="Gerado pelo título" /></label><label className="is-wide">Descrição<textarea name="description" maxLength={3000} rows={5} defaultValue={editing?.description ?? ""} /></label><label>Categoria<input name="category" required defaultValue={editing?.category ?? "Eventos especiais"} /></label><label>Local<input name="location" defaultValue={editing?.location ?? "Igreja Casa Forte Erechim"} /></label><label>Data de início<input type="date" name="startDate" required defaultValue={editing?.start_date ?? ""} /></label><label>Data de término<input type="date" name="endDate" defaultValue={editing?.end_date ?? ""} /></label><label>Horário inicial<input type="time" name="startTime" defaultValue={editing?.start_time?.slice(0, 5) ?? ""} /></label><label>Horário final<input type="time" name="endTime" defaultValue={editing?.end_time?.slice(0, 5) ?? ""} /></label><label>Status<select name="status" defaultValue={editing?.status ?? "confirmed"}>{EVENT_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Limite de vagas<input type="number" min="1" name="capacity" defaultValue={editing?.capacity ?? ""} placeholder="Sem limite" /></label><label>Valor da inscrição<input name="registrationFee" inputMode="decimal" defaultValue={editing ? (editing.registration_fee_cents / 100).toFixed(2).replace(".", ",") : "0,00"} placeholder="0,00 para gratuito" /></label><label>Prazo final<input type="datetime-local" name="registrationDeadline" defaultValue={editing?.registration_deadline?.slice(0, 16) ?? ""} /></label><label>Imagem do card<input type="url" name="imageUrl" defaultValue={editing?.image_url ?? ""} placeholder="https://" /></label>
    <fieldset className="is-wide"><legend>Configurações</legend><label><input type="checkbox" name="registrationEnabled" defaultChecked={editing?.registration_enabled ?? false} /> Aceita inscrições</label><label><input type="checkbox" name="registrationOpen" defaultChecked={editing?.registration_status === "open"} /> Inscrições abertas</label><label><input type="checkbox" name="isPublic" defaultChecked={editing ? editing.is_public : true} /> Evento público</label><label><input type="checkbox" name="isFeatured" defaultChecked={editing?.is_featured ?? false} /> Evento em destaque</label></fieldset>
    <div className="admin-event-form-actions is-wide"><button type="submit">{editing ? "Salvar alterações" : "Criar evento"}</button>{editing ? <Link href="/admin/eventos">Cancelar</Link> : null}</div></form></article>
    <aside className="admin-event-list"><p className="home-kicker">Eventos cadastrados</p><h2>{events.length} eventos</h2>{events.map((event) => { const count = registrations.filter((item) => item.event_id === event.id).length; const state = eventRegistrationState({ ...event, registration_count: count }); const remaining = event.capacity === null ? null : Math.max(event.capacity - count, 0); return <article key={event.id}><div><span>{event.category}</span><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${event.start_date}T12:00:00Z`))}</time></div><h3>{event.title}</h3><p>{event.registration_fee_cents > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(event.registration_fee_cents / 100) : "Gratuito"} · {state.label} · {count} inscrito{count === 1 ? "" : "s"}{remaining !== null ? ` · ${remaining} vagas` : ""}</p><div><Link href={`/admin/eventos?editar=${event.id}`}>Editar</Link><Link href={`/admin/eventos?tab=inscricoes&evento=${event.id}`}>Ver inscritos</Link><form action={archiveEvent}><input type="hidden" name="eventId" value={event.id} /><button type="submit">Arquivar</button></form></div></article>; })}</aside></section>;
}

function RegistrationsTab({ events, registrations, filters }: { events: EventRow[]; registrations: RegistrationRow[]; filters: Search }) {
  const exportParams = new URLSearchParams(); if (filters.evento) exportParams.set("evento", filters.evento); if (filters.status) exportParams.set("status", filters.status); if (filters.busca) exportParams.set("busca", filters.busca);
  return <section className="admin-registrations"><form className="admin-registration-filters"><input type="hidden" name="tab" value="inscricoes" /><label>Evento<select name="evento" defaultValue={filters.evento ?? ""}><option value="">Todos os eventos</option>{events.map((event) => <option value={event.id} key={event.id}>{event.title} · {event.start_date}</option>)}</select></label><label>Status<select name="status" defaultValue={filters.status ?? ""}><option value="">Todos os status</option>{REGISTRATION_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Nome, e-mail ou telefone<input name="busca" defaultValue={filters.busca ?? ""} placeholder="Pesquisar" /></label><label>Ordenar<select name="ordem" defaultValue={filters.ordem ?? "recentes"}><option value="recentes">Mais recentes</option><option value="antigas">Mais antigas</option></select></label><button type="submit">Filtrar</button><Link href="/admin/eventos?tab=inscricoes">Limpar</Link><a href={`/admin/eventos/exportar?${exportParams}`}>Exportar CSV</a></form>
    <div className="admin-registration-table"><table><thead><tr><th>Participante</th><th>Contato</th><th>Evento</th><th>Inscrição</th><th>Status</th><th>Detalhes</th></tr></thead><tbody>{registrations.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong><small>{item.completed_encounter === null ? optionLabel(ATTENDANCE_OPTIONS, item.attendance_duration) : item.completed_encounter ? "Fez o Encontro com Deus" : "Não fez o Encontro com Deus"}</small></td><td><a href={`https://wa.me/55${item.phone_normalized}`} target="_blank" rel="noreferrer">{item.phone}</a>{item.email ? <small>{item.email}</small> : null}</td><td>{item.events?.title ?? "Evento"}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</td><td><span data-status={item.status}>{optionLabel(REGISTRATION_STATUSES, item.status)}</span></td><td><details><summary>Abrir</summary><form action={saveRegistration}><input type="hidden" name="registrationId" value={item.id} /><label>Nome<input name="fullName" required defaultValue={item.full_name} /></label><label>E-mail<input name="email" type="email" defaultValue={item.email ?? ""} /></label><label>Telefone<input name="phone" required defaultValue={item.phone} /></label>{item.completed_encounter === null ? <label>Tempo na Casa<select name="attendanceDuration" defaultValue={item.attendance_duration}>{ATTENDANCE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label> : <><input type="hidden" name="attendanceDuration" value={item.attendance_duration} /><p><strong>Fez o Encontro com Deus:</strong> {item.completed_encounter ? "Sim" : "Não"}</p></>}<label>Status<select name="status" defaultValue={item.status}>{REGISTRATION_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Observações<textarea name="notes" rows={4} maxLength={1500} defaultValue={item.notes} /></label><button type="submit">Salvar participante</button></form><form action={archiveRegistration}><input type="hidden" name="registrationId" value={item.id} /><button className="is-danger" type="submit">Arquivar inscrição</button></form></details></td></tr>)}</tbody></table>{registrations.length === 0 ? <p>Nenhuma inscrição encontrada com estes filtros.</p> : null}</div>
  </section>;
}
