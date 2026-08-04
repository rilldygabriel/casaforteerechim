import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getVercelOidcToken } from "@vercel/oidc";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import PasswordResetActions from "./password-reset-actions";
import "../members.css";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPABASE_ADMIN_MEMBER_PHOTO_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/admin-member-photo";
const SUPABASE_SIGNED_PHOTO_ORIGIN =
  "https://fjwkfpwraipxmcjlwssv.supabase.co";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

const MEMBER_DETAIL_FIELDS =
  "user_id,email,full_name,phone,instagram,birth_date,address,church_since_month,jesus_year,attended_other_church,previous_church_name,previous_ministry,baptized,married,spouse_name,ministries,photo_url,profile_completed,is_admin,approval_status,church_status,created_at,updated_at,approved_at" as const;

const APPROVAL_LABELS: Record<string, string> = {
  pending: "Aguardando",
  approved: "Acesso liberado",
  rejected: "Acesso suspenso",
};

const CHURCH_STATUS_LABELS: Record<string, string> = {
  aguardando_aprovacao: "Aguardando",
  membro: "Membro",
  congregado: "Congregado",
  afastado: "Afastado",
  inativo: "Inativo",
};

export const metadata: Metadata = {
  title: "Perfil do membro",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function textOrFallback(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return "Não informado";
  }

  return value ? "Sim" : "Não";
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.slice(0, 10).split("-");

  return `${day}/${month}/${year}`;
}

function formatMonthYear(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  const [year, month] = value.slice(0, 7).split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return `${monthName.charAt(0).toLocaleUpperCase("pt-BR")}${monthName.slice(1)} de ${year}`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatTimeInHouse(churchSinceMonth: string | null) {
  if (!churchSinceMonth) {
    return "Tempo de Casa ainda não informado";
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

function getInitials(fullName: string) {
  const names = fullName.trim().split(/\s+/).filter(Boolean);

  if (names.length === 0) {
    return "CF";
  }

  const first = names[0]?.[0] ?? "";
  const last = names.length > 1 ? names.at(-1)?.[0] ?? "" : "";

  return `${first}${last}`.toLocaleUpperCase("pt-BR");
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10) {
    return null;
  }

  const internationalNumber =
    digits.length <= 11 ? `55${digits}` : digits;

  return `https://wa.me/${internationalNumber}`;
}

async function getAdminMemberPhotoUrl(
  adminUserId: string,
  memberId: string,
) {
  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });
    const response = await fetch(SUPABASE_ADMIN_MEMBER_PHOTO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        adminUserId,
        memberId,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as {
      ok?: unknown;
      signedUrl?: unknown;
    };

    if (
      result.ok !== true ||
      typeof result.signedUrl !== "string"
    ) {
      return null;
    }

    const signedUrl = new URL(result.signedUrl);

    if (
      signedUrl.origin !== SUPABASE_SIGNED_PHOTO_ORIGIN ||
      !signedUrl.pathname.startsWith(
        "/storage/v1/object/sign/member-profile-photos/",
      )
    ) {
      return null;
    }

    return signedUrl.toString();
  } catch {
    return null;
  }
}

function ProfileField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={wide ? "admin-member-detail-field-wide" : undefined}
    >
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function AdminMemberProfilePage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: adminProfile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminProfile?.is_admin) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login?erro=sem-permissao");
  }

  const { memberId } = await params;

  if (!UUID_PATTERN.test(memberId)) {
    notFound();
  }

  const { data: member, error } = await supabase
    .from("member_profiles")
    .select(MEMBER_DETAIL_FIELDS)
    .eq("user_id", memberId)
    .maybeSingle();

  if (error || !member) {
    notFound();
  }

  const memberName = member.full_name || "Nome não informado";
  const whatsAppUrl = getWhatsAppUrl(member.phone);
  const signedPhotoUrl = member.photo_url
    ? await getAdminMemberPhotoUrl(user.id, memberId)
    : null;

  return (
    <main className="admin-visitors-page admin-member-detail-page">
      <header className="admin-section-header">
        <Link href="/admin" aria-label="Voltar ao início do painel">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={190}
            height={74}
            priority
          />
        </Link>
        <nav aria-label="Navegação administrativa">
          <Link href="/admin/membros">Voltar aos membros</Link>
        </nav>
      </header>

      <section className="admin-member-detail-hero">
        <div className="admin-member-detail-photo">
          {signedPhotoUrl ? (
            <Image
              src={signedPhotoUrl}
              alt={`Foto de perfil de ${memberName}`}
              fill
              sizes="(max-width: 700px) 132px, 180px"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">{getInitials(memberName)}</span>
          )}
        </div>

        <div className="admin-member-detail-identity">
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            {member.is_admin ? "Administrador" : "Perfil do membro"}
          </p>
          <h1>{memberName}</h1>
          <p>{formatTimeInHouse(member.church_since_month)}</p>
          <div className="admin-member-detail-badges">
            <strong data-status={member.approval_status}>
              {APPROVAL_LABELS[member.approval_status] ??
                member.approval_status}
            </strong>
            <strong data-earned={member.profile_completed}>
              {member.profile_completed
                ? "★ Estrela da Família"
                : "Perfil incompleto"}
            </strong>
          </div>
        </div>
      </section>

      <section className="admin-member-detail-sections">
        <article className="admin-member-detail-card">
          <header>
            <span>01</span>
            <h2>Dados pessoais</h2>
          </header>
          <dl>
            <ProfileField label="Nome completo">
              {memberName}
            </ProfileField>
            <ProfileField label="WhatsApp">
              {whatsAppUrl ? (
                <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                  {textOrFallback(member.phone)}
                </a>
              ) : (
                textOrFallback(member.phone)
              )}
            </ProfileField>
            <ProfileField label="E-mail">
              <a href={`mailto:${member.email}`}>{member.email}</a>
            </ProfileField>
            <ProfileField label="Data de nascimento">
              {formatDateOnly(member.birth_date)}
            </ProfileField>
            <ProfileField label="Estado civil">
              {member.married === null
                ? "Não informado"
                : member.married
                  ? "Casado(a)"
                  : "Não casado(a)"}
            </ProfileField>
            <ProfileField label="Nome do cônjuge">
              {member.married
                ? textOrFallback(member.spouse_name)
                : "Não se aplica"}
            </ProfileField>
            <ProfileField label="Instagram">
              {textOrFallback(member.instagram)}
            </ProfileField>
            <ProfileField label="Endereço" wide>
              {textOrFallback(member.address)}
            </ProfileField>
          </dl>
        </article>

        <article className="admin-member-detail-card">
          <header>
            <span>02</span>
            <h2>Caminhada de fé</h2>
          </header>
          <dl>
            <ProfileField label="Frequenta a Casa desde">
              {formatMonthYear(member.church_since_month)}
            </ProfileField>
            <ProfileField label="Tempo de Casa">
              {formatTimeInHouse(member.church_since_month)}
            </ProfileField>
            <ProfileField label="Ano em que aceitou Jesus">
              {member.jesus_year ?? "Não informado"}
            </ProfileField>
            <ProfileField label="Já frequentou outra igreja evangélica?">
              {formatBoolean(member.attended_other_church)}
            </ProfileField>
            <ProfileField label="Igreja anterior">
              {member.attended_other_church
                ? textOrFallback(member.previous_church_name)
                : "Não se aplica"}
            </ProfileField>
            <ProfileField label="Batizado nas águas?">
              {formatBoolean(member.baptized)}
            </ProfileField>
            <ProfileField label="Ministério anterior">
              {textOrFallback(member.previous_ministry)}
            </ProfileField>
            <ProfileField label="Ministérios atuais">
              {member.ministries.length > 0
                ? member.ministries.join(", ")
                : "Não informado"}
            </ProfileField>
          </dl>
        </article>

        <article className="admin-member-detail-card">
          <header>
            <span>03</span>
            <h2>Cadastro e acesso</h2>
          </header>
          <dl>
            <ProfileField label="Situação na Casa">
              {CHURCH_STATUS_LABELS[member.church_status] ??
                member.church_status}
            </ProfileField>
            <ProfileField label="Acesso à Área da Família">
              {APPROVAL_LABELS[member.approval_status] ??
                member.approval_status}
            </ProfileField>
            <ProfileField label="Perfil completo">
              {member.profile_completed ? "Sim — estrela conquistada" : "Não"}
            </ProfileField>
            <ProfileField label="Tipo de conta">
              {member.is_admin ? "Administrador" : "Membro"}
            </ProfileField>
            <ProfileField label="Cadastro criado">
              {formatTimestamp(member.created_at)}
            </ProfileField>
            <ProfileField label="Última atualização">
              {formatTimestamp(member.updated_at)}
            </ProfileField>
            <ProfileField label="Acesso liberado em">
              {formatTimestamp(member.approved_at)}
            </ProfileField>
          </dl>
          <PasswordResetActions memberId={member.user_id} hasPhone={Boolean(whatsAppUrl)} />
        </article>
      </section>
    </main>
  );
}
