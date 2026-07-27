"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  INITIAL_MEMBER_APPROVAL_ACTION_STATE,
  reviewMemberApplication,
  updateMemberApproval,
} from "./actions";

export type MemberApplicationRecord = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  status: "pending" | "invited" | "rejected";
  auth_user_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type MemberApprovalRecord = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  approval_status: "pending" | "approved" | "rejected";
  church_status:
    | "aguardando_aprovacao"
    | "membro"
    | "congregado"
    | "afastado"
    | "inativo";
  is_admin: boolean;
  created_at: string;
  approved_at: string | null;
};

type MembersListProps = {
  applications: MemberApplicationRecord[];
  members: MemberApprovalRecord[];
  hasLoadError: boolean;
};

const STATUS_LABELS: Record<MemberApprovalRecord["approval_status"], string> = {
  pending: "Aguardando",
  approved: "Aprovado",
  rejected: "Não liberado",
};

const APPLICATION_STATUS_LABELS: Record<
  MemberApplicationRecord["status"],
  string
> = {
  pending: "Aguardando",
  invited: "Convite enviado",
  rejected: "Não aprovado",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function MemberApprovalControls({
  member,
}: {
  member: MemberApprovalRecord;
}) {
  const [state, formAction, isPending] = useActionState(
    updateMemberApproval,
    INITIAL_MEMBER_APPROVAL_ACTION_STATE,
  );

  if (member.is_admin) {
    return (
      <div className="admin-member-protected-note">
        Administrador principal — acesso protegido.
      </div>
    );
  }

  const nextStatus =
    member.approval_status === "approved" ? "rejected" : "approved";

  return (
    <form className="admin-member-approval" action={formAction}>
      <input type="hidden" name="memberId" value={member.user_id} />
      <input type="hidden" name="status" value={nextStatus} />
      <p
        data-kind={state.kind}
        role={state.kind === "error" ? "alert" : "status"}
      >
        {state.kind === "idle"
          ? "O cadastro não pode ser apagado por este painel."
          : state.message}
      </p>
      <button
        type="submit"
        data-action={nextStatus}
        disabled={isPending}
      >
        {isPending
          ? "Salvando..."
          : nextStatus === "approved"
            ? "Aprovar acesso"
            : "Suspender acesso"}
      </button>
    </form>
  );
}

function MemberApplicationControls({
  application,
}: {
  application: MemberApplicationRecord;
}) {
  const [state, formAction, isPending] = useActionState(
    reviewMemberApplication,
    INITIAL_MEMBER_APPROVAL_ACTION_STATE,
  );

  if (application.status === "invited") {
    return (
      <div className="admin-member-protected-note">
        Convite já enviado. A conta pode ser administrada na lista abaixo.
      </div>
    );
  }

  return (
    <form className="admin-member-approval" action={formAction}>
      <input
        type="hidden"
        name="applicationId"
        value={application.id}
      />
      <p
        data-kind={state.kind}
        role={state.kind === "error" ? "alert" : "status"}
      >
        {state.kind === "idle"
          ? "A aprovação cria a conta e envia um único convite."
          : state.message}
      </p>
      <div className="admin-member-approval-buttons">
        {application.status === "pending" ? (
          <button
            type="submit"
            name="decision"
            value="reject"
            data-action="rejected"
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Não aprovar"}
          </button>
        ) : null}
        <button
          type="submit"
          name="decision"
          value="approve"
          data-action="approved"
          disabled={isPending}
        >
          {isPending ? "Enviando..." : "Aprovar e convidar"}
        </button>
      </div>
    </form>
  );
}

export default function MembersList({
  applications,
  members,
  hasLoadError,
}: MembersListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "todos" | MemberApprovalRecord["approval_status"]
  >("todos");

  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return members.filter((member) => {
      const matchesStatus =
        status === "todos" || member.approval_status === status;
      const searchTarget = normalizeText(
        [member.full_name, member.email, member.phone].join(" "),
      );

      return matchesStatus && searchTarget.includes(normalizedQuery);
    });
  }, [members, query, status]);

  const pending = members.filter(
    (member) => member.approval_status === "pending",
  ).length +
    applications.filter((application) => application.status === "pending")
      .length;
  const approved = members.filter(
    (member) => member.approval_status === "approved",
  ).length;

  if (hasLoadError) {
    return (
      <section className="admin-visitors-state admin-visitors-error" role="alert">
        <span aria-hidden="true">!</span>
        <h2>Não foi possível carregar os cadastros.</h2>
        <p>Nenhum acesso foi alterado. Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  return (
    <>
      <section className="admin-visitors-metrics" aria-label="Resumo">
        <article>
          <span>Membros</span>
          <strong>{members.length}</strong>
          <p>contas da Família</p>
        </article>
        <article>
          <span>Aguardando</span>
          <strong>{pending}</strong>
          <p>pedidos para revisar</p>
        </article>
        <article>
          <span>Liberados</span>
          <strong>{approved}</strong>
          <p>acessos à Família</p>
        </article>
      </section>

      <section
        className="admin-visitors-content admin-member-applications"
        aria-labelledby="member-application-list-title"
      >
        <div className="admin-visitors-toolbar">
          <div>
            <p
              className="admin-visitors-label"
              id="member-application-list-title"
            >
              Solicitações de entrada
            </p>
            <p>
              {applications.length}{" "}
              {applications.length === 1 ? "solicitação" : "solicitações"}
            </p>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhuma solicitação recebida ainda.</h2>
            <p>Os novos pedidos aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="admin-members-list">
            {applications.map((application) => (
              <article
                className="admin-member-card"
                key={application.id}
              >
                <header>
                  <div>
                    <span>Solicitação #{application.id}</span>
                    <h2>
                      {application.auth_user_id ? (
                        <Link
                          className="admin-member-name-link"
                          href={`/admin/membros/${application.auth_user_id}`}
                        >
                          {application.full_name}
                        </Link>
                      ) : (
                        application.full_name
                      )}
                    </h2>
                    <p>{application.email}</p>
                  </div>
                  <strong data-status={application.status}>
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </strong>
                </header>

                <dl>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{application.phone}</dd>
                  </div>
                  <div>
                    <dt>Solicitação recebida</dt>
                    <dd>{formatDate(application.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Última revisão</dt>
                    <dd>{formatDate(application.reviewed_at)}</dd>
                  </div>
                </dl>

                <MemberApplicationControls application={application} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-visitors-content" aria-labelledby="member-list-title">
        <div className="admin-visitors-toolbar">
          <div>
            <p className="admin-visitors-label" id="member-list-title">
              Contas da Família
            </p>
            <p>
              {filteredMembers.length}{" "}
              {filteredMembers.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>

          <div className="admin-visitors-filters">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nome, e-mail ou WhatsApp"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as
                      | "todos"
                      | MemberApprovalRecord["approval_status"],
                  )
                }
              >
                <option value="todos">Todos</option>
                <option value="pending">Aguardando</option>
                <option value="approved">Aprovados</option>
                <option value="rejected">Não liberados</option>
              </select>
            </label>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum cadastro recebido ainda.</h2>
            <p>As contas criadas por convite aparecerão aqui automaticamente.</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum resultado encontrado.</h2>
            <p>Altere a busca ou o filtro para ver outros cadastros.</p>
          </div>
        ) : (
          <div className="admin-members-list">
            {filteredMembers.map((member) => (
              <article className="admin-member-card" key={member.user_id}>
                <header>
                  <div>
                    <span>{member.is_admin ? "Administrador" : "Membro"}</span>
                    <h2>
                      <Link
                        className="admin-member-name-link"
                        href={`/admin/membros/${member.user_id}`}
                      >
                        {member.full_name || "Nome não informado"}
                      </Link>
                    </h2>
                    <p>{member.email}</p>
                    <Link
                      className="admin-member-open-profile"
                      href={`/admin/membros/${member.user_id}`}
                    >
                      Ver perfil completo →
                    </Link>
                  </div>
                  <strong data-status={member.approval_status}>
                    {STATUS_LABELS[member.approval_status]}
                  </strong>
                </header>

                <dl>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{member.phone || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Cadastro criado</dt>
                    <dd>{formatDate(member.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Acesso aprovado</dt>
                    <dd>{formatDate(member.approved_at)}</dd>
                  </div>
                </dl>

                <MemberApprovalControls member={member} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
