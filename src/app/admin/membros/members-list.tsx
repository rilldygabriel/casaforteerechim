"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import MemberInviteResendButton from "./member-invite-resend-button";

export type MemberListRecord = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  profile_completed: boolean;
  created_at: string;
  email_verified?: boolean;
  phone_verified?: boolean;
};

type MembersListProps = {
  members: MemberListRecord[];
  hasLoadError: boolean;
};

type SortOrder = "alphabetical" | "recent";
type VerificationFilter = "all" | "verified" | "unverified";

export default function MembersList({
  members,
  hasLoadError,
}: MembersListProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>("unverified");

  const memberCounts = useMemo(() => {
    const verified = members.filter(
      ({ email_verified, phone_verified }) =>
        email_verified || phone_verified,
    ).length;

    return {
      all: members.length,
      verified,
      unverified: members.length - verified,
    };
  }, [members]);

  const visibleMembers = useMemo(() => {
    return members
      .filter((member) => {
        const isVerified =
          member.email_verified === true ||
          member.phone_verified === true;

        if (verificationFilter === "verified") {
          return isVerified;
        }

        if (verificationFilter === "unverified") {
          return !isVerified;
        }

        return true;
      })
      .sort((first, second) => {
        if (sortOrder === "recent") {
          return (
            new Date(second.created_at).getTime() -
            new Date(first.created_at).getTime()
          );
        }

        return (first.full_name || "Nome não informado").localeCompare(
          second.full_name || "Nome não informado",
          "pt-BR",
          { sensitivity: "base" },
        );
      });
  }, [members, sortOrder, verificationFilter]);

  if (hasLoadError) {
    return (
      <section className="admin-visitors-state admin-visitors-error" role="alert">
        <span aria-hidden="true">!</span>
        <h2>Não foi possível carregar os membros.</h2>
        <p>Nenhum dado foi alterado. Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  return (
    <section
      className="admin-member-directory"
      aria-labelledby="member-directory-title"
    >
      <header className="admin-member-directory-header">
        <div>
          <h2 id="member-directory-title">Lista de membros</h2>
          <p>
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </p>
        </div>

        <label>
          <span>Ordenar por</span>
          <select
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as SortOrder)
            }
          >
            <option value="alphabetical">Ordem alfabética (A–Z)</option>
            <option value="recent">Últimos inscritos</option>
          </select>
        </label>
      </header>

      <div
        className="admin-member-verification-tabs"
        aria-label="Filtrar membros por verificação"
      >
        {([
          ["unverified", "Não verificados"],
          ["verified", "Verificados"],
          ["all", "Todos"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={verificationFilter === value}
            onClick={() => setVerificationFilter(value)}
          >
            {label} <span>{memberCounts[value]}</span>
          </button>
        ))}
      </div>

      {visibleMembers.length === 0 ? (
        <div className="admin-visitors-state">
          <span aria-hidden="true">0</span>
          <h2>Nenhum membro nesta aba.</h2>
          <p>Use as outras abas para consultar os demais cadastros.</p>
        </div>
      ) : (
        <ol className="admin-member-directory-list">
          {visibleMembers.map((member, index) => (
            <li key={member.user_id}>
              <Link
                className="admin-member-directory-profile"
                href={`/admin/membros/${member.user_id}`}
              >
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="admin-member-directory-copy">
                  <strong>{member.full_name || "Nome não informado"}</strong>
                  <small>
                    {member.email || member.phone || "Contato não informado"}
                  </small>
                  <span className="admin-member-directory-badges">
                    <em
                      data-status={
                        member.profile_completed ? "complete" : "incomplete"
                      }
                    >
                      {member.profile_completed
                        ? "Cadastro completo"
                        : "Cadastro incompleto"}
                    </em>
                    {member.email_verified ? <em>E-mail verificado</em> : null}
                    {member.phone_verified ? <em>WhatsApp verificado</em> : null}
                    {member.email_verified || member.phone_verified ? null : (
                      <em data-status="unverified">Não verificado</em>
                    )}
                  </span>
                </div>
                <span aria-hidden="true">→</span>
              </Link>
              {!member.email_verified &&
              !member.phone_verified &&
              member.email ? (
                <MemberInviteResendButton
                  memberId={member.user_id}
                  memberName={member.full_name || "membro"}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
