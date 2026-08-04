import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import PixCopyButton from "@/components/pix-copy-button";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import LocationCheckin from "./location-checkin";
import ProfileForm from "./profile-form";
import { ProfilePhotoUploader } from "./profile-photo-uploader";
import PushNotifications from "./push-notifications";

const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";
const PASTOR_URL = "https://wa.me/5554992640253";

type BirthdayMember = {
  fullName: string;
  photoUrl: string | null;
};

function getTodayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return {
    month: parts.find((part) => part.type === "month")?.value ?? "",
    day: parts.find((part) => part.type === "day")?.value ?? "",
  };
}

async function getBirthdayMembers(): Promise<BirthdayMember[]> {
  try {
    const serviceSupabase = getSupabaseServiceClient();
    const { month, day } = getTodayInSaoPaulo();
    const { data, error } = await serviceSupabase
      .from("member_profiles")
      .select("full_name,birth_date,photo_url")
      .not("birth_date", "is", null)
      .or("approval_status.eq.approved,is_admin.eq.true")
      .order("full_name");

    if (error) {
      return [];
    }

    const birthdayProfiles = (data ?? []).filter((member) => {
      const [, birthMonth, birthDay] = (member.birth_date ?? "").split("-");
      return birthMonth === month && birthDay === day;
    });

    return Promise.all(
      birthdayProfiles.map(async (member) => {
        let photoUrl: string | null = null;

        if (member.photo_url) {
          const { data: signedPhoto } = await serviceSupabase.storage
            .from("member-profile-photos")
            .createSignedUrl(member.photo_url, 15 * 60);

          photoUrl = signedPhoto?.signedUrl ?? null;
        }

        return {
          fullName: member.full_name || "Membro Casa Forte",
          photoUrl,
        };
      }),
    );
  } catch {
    return [];
  }
}

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

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

export default async function Familia() {
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
      "full_name,phone,birth_date,address,church_since_month,jesus_year,attended_other_church,previous_church_name,baptized,married,spouse_name,photo_url,profile_completed,is_admin,approval_status",
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
  const hasProfileStar =
    profile.profile_completed === true && completedProfileSteps === 9;
  const memberName = profile.full_name || user.email || "Membro Casa Forte";
  const birthdayMembers = await getBirthdayMembers();
  let signedPhotoUrl: string | null = null;

  if (profile.photo_url) {
    const { data: signedPhoto } = await supabase.storage
      .from("member-profile-photos")
      .createSignedUrl(profile.photo_url, 60 * 60);

    signedPhotoUrl = signedPhoto?.signedUrl ?? null;
  }

  return (
    <main className="inner-page family-page">
      <FamilyHeader signOut={signOut} />

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
        <LocationCheckin />
      </section>

      <section className="family-birthday-card" aria-labelledby="birthday-title">
        <div className="family-birthday-heading">
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            Aniversariante do dia
          </p>
          <h2 id="birthday-title">
            {birthdayMembers.length > 0
              ? birthdayMembers.length === 1
                ? "Hoje a Casa celebra uma vida!"
                : "Hoje a Casa celebra vidas!"
              : "Hoje não temos aniversariantes."}
          </h2>
          <p>
            {birthdayMembers.length > 0
              ? "Que este novo ciclo seja cheio da presença de Deus, alegria e propósito."
              : "Quando alguém da família completar mais um ano, vamos celebrar juntos aqui."}
          </p>
        </div>

        {birthdayMembers.length > 0 && (
          <div className="family-birthday-list">
            {birthdayMembers.map((birthdayMember) => (
              <article
                className="family-birthday-person"
                key={birthdayMember.fullName}
              >
                <div className="family-birthday-photo">
                  {birthdayMember.photoUrl ? (
                    <Image
                      src={birthdayMember.photoUrl}
                      alt={`Foto de ${birthdayMember.fullName}`}
                      fill
                      sizes="(max-width: 780px) 112px, 132px"
                    />
                  ) : (
                    <span aria-hidden="true">
                      {getInitials(birthdayMember.fullName)}
                    </span>
                  )}
                </div>
                <div>
                  <span>Parabéns!</span>
                  <h3>{birthdayMember.fullName}</h3>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PushNotifications />

      <details
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
              aria-label={`${completedProfileSteps} de 9 etapas concluídas`}
            >
              <span
                style={{ width: `${(completedProfileSteps / 9) * 100}%` }}
              />
            </div>
            <strong>{completedProfileSteps} de 9 etapas concluídas</strong>
          </aside>

          <ProfileForm
            initialProfile={{
              fullName: profile.full_name,
              phone: profile.phone,
              birthDate: profile.birth_date ?? "",
              address: profile.address,
              churchSinceMonth: profile.church_since_month?.slice(0, 7) ?? "",
              jesusYear: profile.jesus_year,
              attendedOtherChurch: profile.attended_other_church,
              previousChurchName: profile.previous_church_name,
              baptized: profile.baptized,
              married: profile.married,
              spouseName: profile.spouse_name,
            }}
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

      <section className="family-generosity-cta">
        <div className="family-generosity-copy">
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            Generosidade
          </p>
          <h2>Contribua com um toque</h2>
          <p>
            Escolha a finalidade e copie a chave PIX sem sair da Área da
            Família.
          </p>
        </div>
        <div
          className="family-generosity-actions"
          aria-label="Chaves PIX da Casa Forte"
        >
          <div className="family-generosity-option">
            <span>Primícias</span>
            <strong>54 99321-7227</strong>
            <PixCopyButton
              pixKey="54993217227"
              label="Copiar PIX de Primícias"
              className="family-generosity-pix-button"
            />
          </div>
          <div className="family-generosity-option">
            <span>Dízimos e ofertas</span>
            <strong>46.534.858/0001-37</strong>
            <PixCopyButton
              pixKey="46534858000137"
              label="Copiar PIX de Dízimos e ofertas"
              className="family-generosity-pix-button"
            />
          </div>
        </div>
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
    </main>
  );
}

function FamilyHeader({
  signOut,
}: {
  signOut: () => Promise<void>;
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
