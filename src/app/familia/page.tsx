import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import BirthdayCarousel from "@/components/birthday-carousel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import LocationCheckin from "./location-checkin";
import ProfileForm from "./profile-form";
import { ProfilePhotoUploader } from "./profile-photo-uploader";
import PushNotifications from "./push-notifications";
import ThemeToggle from "@/components/theme-toggle";
import { requestDiscipler } from "./discipleship-actions";

const GROUP_URL =
  "https://chat.whatsapp.com/H5SH31KKmeZ6YHyV5WiAk2?mode=gi_t";
const PASTOR_URL = "https://wa.me/5554992640253";

function hasText(value: string | null | undefined, minimumLength: number) {
  return (value ?? "").trim().length >= minimumLength;
}

function countProfileSteps(profile: {
  full_name: string;
  phone: string;
  birth_date: string | null;
  address: string;
  church_since_month: string | null;
  jesus_year: number | null;
  attended_other_church: boolean | null;
  previous_church_name: string;
  baptized: boolean | null;
  married: boolean | null;
  spouse_name: string;
  has_discipler: boolean | null;
  serves_ministry: boolean | null;
}) {
  const phoneDigits = profile.phone.replace(/\D/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));

  return [
    hasText(profile.full_name, 3) && profile.full_name.length <= 160,
    phoneDigits.length >= 10 && phoneDigits.length <= 15,
    Boolean(
      profile.birth_date &&
        profile.birth_date >= "1900-01-01" &&
        profile.birth_date <= today,
    ),
    hasText(profile.address, 8) && profile.address.length <= 500,
    Boolean(
      profile.church_since_month &&
        profile.church_since_month <= `${currentMonth}-01`,
    ),
    profile.jesus_year !== null &&
      profile.jesus_year >= 1900 &&
      profile.jesus_year <= currentYear,
    profile.attended_other_church !== null &&
      (!profile.attended_other_church ||
        (hasText(profile.previous_church_name, 2) &&
          profile.previous_church_name.length <= 160)),
    profile.baptized !== null,
    profile.married !== null &&
      (!profile.married ||
        (hasText(profile.spouse_name, 3) &&
        profile.spouse_name.length <= 160)),
    profile.has_discipler !== null,
    profile.serves_ministry !== null,
  ].filter(Boolean).length;
}

function getMemberWhatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function formatTimeInHouse(churchSinceMonth: string | null) {
  if (!churchSinceMonth) {
    return "Complete desde quando você frequenta a Casa";
  }

  const [year, month] = churchSinceMonth.slice(0, 7).split("-").map(Number);
  const currentDateParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const currentYear = Number(
    currentDateParts.find((part) => part.type === "year")?.value,
  );
  const currentMonth = Number(
    currentDateParts.find((part) => part.type === "month")?.value,
  );
  const totalMonths =
    currentYear * 12 +
    currentMonth -
    1 -
    (year * 12 + month - 1);

  if (totalMonths <= 0) {
    return "Frequenta a Casa desde este mês";
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearText = years === 1 ? "1 ano" : `${years} anos`;
  const monthText = months === 1 ? "1 mês" : `${months} meses`;

  if (years === 0) {
    return `Frequenta a Casa há ${monthText}`;
  }

  if (months === 0) {
    return `Frequenta a Casa há ${yearText}`;
  }

  return `Frequenta a Casa há ${yearText} e ${monthText}`;
}

export const metadata: Metadata = {
  title: "Família",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Familia({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/familia/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("member_profiles")
    .select(
      "full_name,phone,birth_date,gender,address,church_since_month,jesus_year,attended_other_church,previous_church_name,baptized,married,spouse_name,has_discipler,serves_ministry,photo_url,profile_completed,is_admin,approval_status",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  async function signOut() {
    "use server";
    const serverSupabase = await getSupabaseServerClient();
    await serverSupabase.auth.signOut({ scope: "local" });
    redirect("/familia/login");
  }

  const canAccess =
    profile?.is_admin || profile?.approval_status === "approved";

  if (profileError || !profile) {
    return (
      <main className="inner-page family-page">
        <FamilyHeader signOut={signOut} />
        <FamilyAccessState
          eyebrow="Verificação de acesso"
          title="Não foi possível verificar seu cadastro."
          description="Nenhum dado foi alterado. Saia da conta e entre novamente. Se o problema continuar, fale com a Casa Forte."
          contact
        />
      </main>
    );
  }

  if (profile.phone.replace(/\D/g, "").length < 10) {
    redirect("/familia/completar-cadastro");
  }

  if (!canAccess) {
    const rejected = profile.approval_status === "rejected";

    return (
      <main className="inner-page family-page">
        <FamilyHeader signOut={signOut} />
        <FamilyAccessState
          eyebrow={rejected ? "Acesso não liberado" : "Cadastro confirmado"}
          title={
            rejected
              ? "Seu acesso ainda não foi liberado."
              : "Aguardando aprovação."
          }
          description={
            rejected
              ? "A liderança precisa revisar seu cadastro antes de liberar a Área da Família. Fale com a Casa Forte se precisar de ajuda."
              : "Seu cadastro chegou com segurança. Assim que a liderança aprovar, esta página será liberada automaticamente."
          }
          contact={rejected}
        />
      </main>
    );
  }

  const completedProfileSteps = countProfileSteps(profile);
  const hasProfileStar = profile.profile_completed === true && completedProfileSteps === 11;
  const memberName = profile.full_name || user.email || "Membro Casa Forte";
  const [disciplerRole, ministryLeaderRoles, ministryMemberRoles] =
    await Promise.all([
      supabase
        .from("discipler_roles")
        .select("member_id")
        .eq("member_id", user.id)
        .maybeSingle(),
      supabase
        .from("ministry_leaders")
        .select("ministry_key")
        .eq("member_id", user.id),
      supabase
        .from("ministry_members")
        .select("ministry_key")
        .eq("member_id", user.id),
    ]);
  const hasLeadershipArea = Boolean(
    profile.is_admin ||
      disciplerRole.data ||
      ministryLeaderRoles.data?.length ||
      ministryMemberRoles.data?.length,
  );
  const hasManagementPanel = Boolean(
    profile.is_admin ||
      disciplerRole.data ||
      ministryLeaderRoles.data?.length,
  );
  const [{ data: announcements }, { data: announcementReads }] = await Promise.all([
    supabase.from("family_announcements").select("id").order("created_at", { ascending: false }).limit(100),
    supabase.from("family_announcement_reads").select("announcement_id").eq("user_id", user.id),
  ]);
  const readAnnouncementIds = new Set((announcementReads ?? []).map((item) => item.announcement_id));
  const unreadNotifications = (announcements ?? []).filter((item) => !readAnnouncementIds.has(item.id)).length;
  let signedPhotoUrl: string | null = null;
  const service = getSupabaseServiceClient();
  const [ministriesResult, disciplerRolesResult, ministryRequestsResult, discipleshipRequestResult, activeRelationshipResult] = await Promise.all([
    service.from("ministries").select("key,name").eq("active", true).order("sort_order"),
    service.from("discipler_roles").select("member_id,available_for_member_choice"),
    service.from("ministry_membership_requests").select("ministry_key").eq("member_id", user.id),
    service.from("discipleship_requests").select("discipler_id,status").eq("member_id", user.id).maybeSingle(),
    service.from("discipleship_relationships").select("id,discipler_id").eq("disciple_id", user.id).is("ended_at", null).maybeSingle(),
  ]);
  const disciplerIds = (disciplerRolesResult.data ?? []).map((item) => item.member_id).filter((id) => id !== user.id);
  const availableDisciplerIds = new Set(
    (disciplerRolesResult.data ?? [])
      .filter((item) => item.available_for_member_choice && item.member_id !== user.id)
      .map((item) => item.member_id),
  );
  const { data: disciplerProfiles } = disciplerIds.length
    ? await service.from("member_profiles").select("user_id,full_name,photo_url").in("user_id", disciplerIds).eq("approval_status", "approved").order("full_name")
    : { data: [] as { user_id: string; full_name: string; photo_url: string | null }[] };
  const disciplerPhotoUrls = new Map<string, string>();
  await Promise.all(
    (disciplerProfiles ?? []).map(async (discipler) => {
      if (!discipler.photo_url) return;
      const { data } = await service.storage
        .from("member-profile-photos")
        .createSignedUrl(discipler.photo_url, 60 * 60);
      if (data?.signedUrl) disciplerPhotoUrls.set(discipler.user_id, data.signedUrl);
    }),
  );
  const disciplerById = new Map((disciplerProfiles ?? []).map((item) => [item.user_id, item]));
  const activeDiscipler = activeRelationshipResult.data
    ? disciplerById.get(activeRelationshipResult.data.discipler_id) ?? null
    : null;
  const pendingDiscipler = discipleshipRequestResult.data?.status === "pending"
    ? disciplerById.get(discipleshipRequestResult.data.discipler_id) ?? null
    : null;
  const availableDisciplers = (disciplerProfiles ?? []).filter((item) => availableDisciplerIds.has(item.user_id));

  if (profile.photo_url) {
    const { data: signedPhoto } = await supabase.storage
      .from("member-profile-photos")
      .createSignedUrl(profile.photo_url, 60 * 60);

    signedPhotoUrl = signedPhoto?.signedUrl ?? null;
  }

  return (
    <main className="inner-page family-page">
      <FamilyHeader signOut={signOut} unreadNotifications={unreadNotifications} />

      <section className="family-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Sou da Casa
        </p>
        <h1>
          Aqui você é
          <strong>família.</strong>
        </h1>
        <p className="family-hero-copy">
          Este é o espaço de quem vive a Casa durante a semana e quer seguir
          crescendo junto.
        </p>
        <div className="family-member-summary">
          <ProfilePhotoUploader
            userId={user.id}
            fullName={memberName}
            initialPhotoUrl={signedPhotoUrl}
          />
          <div className="family-member-summary-copy">
            <p>Meu perfil na Casa</p>
            <h2>{memberName}</h2>
            {hasProfileStar ? (
              <>
                <a
                  className="family-member-phone"
                  href={getMemberWhatsappUrl(profile.phone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {profile.phone}
                </a>
                <strong>
                  {formatTimeInHouse(profile.church_since_month)}
                </strong>
              </>
            ) : (
              <strong>{formatTimeInHouse(profile.church_since_month)}</strong>
            )}
          </div>
        </div>
      </section>

      {hasLeadershipArea && (
        <section className="family-leadership-access family-access-light">
          <div>
            <p className="section-eyebrow">
              <span aria-hidden="true" />
              Minha liderança
            </p>
            <h2>Funções e equipes da Casa</h2>
            <p>
              Veja os ministérios em que você participa e as áreas que estão
              sob seu cuidado.
            </p>
          </div>
          <Link href={hasManagementPanel ? "/admin" : "/familia/lideranca"}>
            {hasManagementPanel ? "Abrir painel de liderança" : "Abrir minhas funções"}
          </Link>
        </section>
      )}

      <section className="family-leadership-access family-discipleship-access family-access-yellow">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Minha caminhada</p>
          <h2>Meus discipulados</h2>
          <p>Veja seu último encontro, confirme novos horários ou avise que precisa de discipulado.</p>
        </div>
        <Link href="/familia/meus-discipulados">Abrir meus discipulados</Link>
      </section>

      <section className="family-leadership-access family-group-access family-access-light">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Comunidade da Casa</p>
          <h2>Grupo de membros da Casa</h2>
          <p>Entre no grupo oficial para receber avisos e permanecer conectado com a Família Casa Forte.</p>
        </div>
        <a href={GROUP_URL} target="_blank" rel="noreferrer">Entrar no grupo</a>
      </section>

      <section className="family-leadership-access family-calendar-access family-access-yellow">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Programação da Casa</p>
          <h2>Calendário dinâmico</h2>
          <p>Veja cultos, reuniões, encontros e toda a programação atualizada da igreja.</p>
        </div>
        <Link href="/calendario">Abrir calendário</Link>
      </section>

      <section className="family-leadership-access family-generosity-access family-access-light">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Generosidade</p>
          <h2>Generosidade</h2>
          <p>Contribua com primícias, dízimos e ofertas via Pix ou cartão, sem sair do aplicativo.</p>
        </div>
        <Link href="/generosidade">Contribuir agora</Link>
      </section>

      <section className="family-leadership-access family-testimonials-access family-access-yellow">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />O que Deus tem feito</p>
          <h2>Meus testemunhos</h2>
          <p>Publique e edite as histórias que você quer compartilhar com toda a Casa.</p>
        </div>
        <Link href="/familia/testemunhos">Abrir testemunhos</Link>
      </section>

      <BirthdayCarousel variant="family" />

      <details
        id="meu-perfil"
        className="family-profile-details"
        data-complete={hasProfileStar}
        open={!hasProfileStar}
      >
        <summary>
          <span>Ver meu perfil</span>
          <span aria-hidden="true">↓</span>
        </summary>
        <section
          className="family-profile-section"
          aria-label="Perfil do membro"
        >
          <aside
            className="family-profile-reward"
            data-earned={hasProfileStar}
          >
            <span className="family-profile-star" aria-hidden="true">
              {hasProfileStar ? "★" : "☆"}
            </span>
            <p>
              {hasProfileStar ? "Recompensa conquistada" : "Sua recompensa"}
            </p>
            <h2>Estrela da Família</h2>
            <p>
              {hasProfileStar
                ? "Seu perfil está completo. Obrigado por permitir que a Casa cuide de você ainda melhor."
                : "Complete todos os dados da sua caminhada para conquistar esta estrela."}
            </p>
            <div
              className="family-profile-progress"
              aria-label={`${completedProfileSteps} de 11 etapas concluídas`}
            >
              <span
                style={{ width: `${(completedProfileSteps / 11) * 100}%` }}
              />
            </div>
            <strong>{completedProfileSteps} de 11 etapas concluídas</strong>
          </aside>

          <ProfileForm
            initialProfile={{
              fullName: profile.full_name,
              phone: profile.phone,
              birthDate: profile.birth_date ?? "",
              gender: profile.gender,
              address: profile.address,
              churchSinceMonth: profile.church_since_month?.slice(0, 7) ?? "",
              jesusYear: profile.jesus_year,
              attendedOtherChurch: profile.attended_other_church,
              previousChurchName: profile.previous_church_name,
              baptized: profile.baptized,
              married: profile.married,
              spouseName: profile.spouse_name,
              hasDiscipler: profile.has_discipler,
              servesMinistry: profile.serves_ministry,
            }}
            ministries={(ministriesResult.data ?? []).map((item) => ({ value: item.key, label: item.name }))}
            disciplers={(disciplerProfiles ?? []).map((item) => ({ value: item.user_id, label: item.full_name }))}
            initialMinistryKeys={(ministryRequestsResult.data ?? []).map((item) => item.ministry_key)}
            initialDisciplerId={discipleshipRequestResult.data?.discipler_id ?? ""}
          />
        </section>
      </details>

      <section className="family-serve-cta">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Ministérios
        </p>
        <h2>Quero começar a servir na Casa</h2>
        <p>
          Escolha um ministério e avisamos o líder na hora, com seu nome e
          seu WhatsApp.
        </p>
        <Link href="/familia/servir">Ver ministérios</Link>
      </section>

      <section className="family-menu" aria-label="Menu da Família Casa Forte">
        <article className="family-menu-card">
          <span>01</span>
          <h2>Minha caminhada</h2>
          <p>Acompanhe seus próximos passos e continue crescendo na fé.</p>
          <a href={GROUP_URL} target="_blank" rel="noreferrer">
            Acessar grupo oficial
          </a>
        </article>
        <article className="family-menu-card">
          <span>02</span>
          <h2>Palavra da semana</h2>
          <p>Mensagens e conteúdos para fortalecer sua vida durante a semana.</p>
          <a
            href="https://youtube.com/@igrejacasaforte-erechim5031"
            target="_blank"
            rel="noreferrer"
          >
            Ver mensagens
          </a>
        </article>
        <article className="family-menu-card">
          <span>03</span>
          <h2>Meu Devocional</h2>
          <p>Um espaço para fortalecer sua fé e caminhar com a Casa.</p>
          <a
            href="https://ig.me/j/AbbdKixwGYdyTwoi/"
            target="_blank"
            rel="noreferrer"
          >
            Acessar canal do Pastor
          </a>
        </article>
        <article className="family-menu-card">
          <span>04</span>
          <h2>Agenda da Casa</h2>
          <p>Domingo às 19h, quarta às 19h30 e sexta às 19h30.</p>
          <Link href="/calendario">Ver calendário completo</Link>
        </article>
        <article className="family-menu-card">
          <span>05</span>
          <h2>Pedidos de Oração</h2>
          <p>Envie seu pedido e permita que nossa equipe caminhe com você.</p>
          <Link href="/oracao">Enviar pedido</Link>
        </article>
        <article className="family-menu-card">
          <span>06</span>
          <h2>Falar com um Pastor</h2>
          <p>Conte com orientação, cuidado e acompanhamento pastoral.</p>
          <a href={PASTOR_URL} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
          </a>
        </article>
      </section>

      <section className="family-permissions" aria-labelledby="family-permissions-title">
        <div className="family-permissions-heading">
          <p className="section-eyebrow"><span aria-hidden="true" />Permissões do aplicativo</p>
          <h2 id="family-permissions-title">Fique conectado com a Casa</h2>
          <p>Você escolhe o que deseja permitir neste aparelho e pode alterar as permissões quando quiser.</p>
        </div>
        <div className="family-permissions-grid">
          <LocationCheckin />
          <PushNotifications />
        </div>
      </section>

      <section id="escolher-discipulador" className="family-discipler-choice" aria-labelledby="family-discipler-choice-title">
        <header>
          <p className="section-eyebrow"><span aria-hidden="true" />Caminhar acompanhado</p>
          <h2 id="family-discipler-choice-title">Quero ser discipulado</h2>
          <p>Se você ainda não tem discipulador, escolha uma das pessoas disponíveis para caminhar com você.</p>
        </header>

        {(params.sucesso || params.erro) && (
          <p className="family-discipler-feedback" data-kind={params.erro ? "error" : "success"} role="status">
            {params.erro ?? params.sucesso}
          </p>
        )}

        {activeRelationshipResult.data ? (
          <article className="family-current-discipler">
            <DisciplerPhoto name={activeDiscipler?.full_name ?? "Seu discipulador"} url={disciplerPhotoUrls.get(activeRelationshipResult.data.discipler_id)} />
            <div>
              <span>Meu discipulador</span>
              <h3>{activeDiscipler?.full_name ?? "Discipulador cadastrado"}</h3>
              <p>Seu vínculo está ativo. Para trocar, o discipulador atual precisa primeiro liberar você no painel dele. O histórico pastoral não será apagado.</p>
            </div>
          </article>
        ) : pendingDiscipler ? (
          <article className="family-current-discipler is-pending">
            <DisciplerPhoto name={pendingDiscipler.full_name} url={disciplerPhotoUrls.get(pendingDiscipler.user_id)} />
            <div>
              <span>Escolha enviada</span>
              <h3>{pendingDiscipler.full_name}</h3>
              <p>Sua solicitação está aguardando a validação do Pastor Rilldy ou da Pastora Lise.</p>
            </div>
          </article>
        ) : availableDisciplers.length > 0 ? (
          <div className="family-discipler-grid">
            {availableDisciplers.map((discipler) => (
              <article key={discipler.user_id}>
                <DisciplerPhoto name={discipler.full_name} url={disciplerPhotoUrls.get(discipler.user_id)} />
                <h3>{discipler.full_name}</h3>
                <form action={requestDiscipler}>
                  <input type="hidden" name="disciplerId" value={discipler.user_id} />
                  <button type="submit">Escolher discipulador</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="family-discipler-empty">No momento, nenhum discipulador foi liberado para receber novos acompanhamentos. A liderança atualizará esta lista assim que houver disponibilidade.</p>
        )}
      </section>
    </main>
  );
}

function DisciplerPhoto({ name, url }: { name: string; url?: string }) {
  return (
    <div className="family-discipler-photo">
      {url ? (
        <Image src={url} alt={`Foto de ${name}`} width={64} height={64} sizes="64px" />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "C"}</span>
      )}
    </div>
  );
}

function FamilyHeader({
  signOut,
  unreadNotifications = 0,
}: {
  signOut: () => Promise<void>;
  unreadNotifications?: number;
}) {
  return (
    <header className="inner-header">
      <Link href="/" aria-label="Voltar para o início">
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={180}
          height={70}
        />
      </Link>
      <div className="family-header-actions">
        <ThemeToggle />
        <Link className="family-notification-link" href="/familia/notificacoes" aria-label={`Notificações${unreadNotifications ? `, ${unreadNotifications} não lidas` : ""}`}>
          <span aria-hidden="true">●</span>
          <strong>Mensagens</strong>
          {unreadNotifications > 0 ? <em>{unreadNotifications > 99 ? "99+" : unreadNotifications}</em> : null}
        </Link>
        <Link className="inner-back" href="/">
          Voltar ao site
        </Link>
        <form action={signOut}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </header>
  );
}

function FamilyAccessState({
  eyebrow,
  title,
  description,
  contact = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contact?: boolean;
}) {
  return (
    <section className="family-access-state">
      <p className="section-eyebrow">
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>
        <Link href="/">Voltar ao site</Link>
        {contact ? (
          <a href={PASTOR_URL} target="_blank" rel="noreferrer">
            Falar com a Casa
          </a>
        ) : null}
      </div>
    </section>
  );
}
