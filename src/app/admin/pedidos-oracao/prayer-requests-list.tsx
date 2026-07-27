"use client";

import { useActionState, useState, useTransition } from "react";
import {
  markPrayerRequestAsOpened,
  type PrayerRequestActionState,
  type PrayerRequestStatus,
  updatePrayerRequest,
} from "./actions";

const INITIAL_PRAYER_REQUEST_ACTION_STATE: PrayerRequestActionState = {
  kind: "idle",
  message: "",
};

export type PrayerRequestRecord = {
  id: number;
  nome: string;
  telefone: string;
  categoria:
    | "saude"
    | "familia"
    | "vida_espiritual"
    | "casamento"
    | "financeiro"
    | "ansiedade_emocional"
    | "outro";
  pedido: string;
  deseja_contato: boolean;
  urgente: boolean;
  status: PrayerRequestStatus;
  responsavel: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
};

type PrayerRequestsListProps = {
  requests: PrayerRequestRecord[];
  hasLoadError: boolean;
};

const STATUS_LABELS: Record<PrayerRequestStatus, string> = {
  novo: "Novo",
  em_oracao: "Em oração",
  em_contato: "Em contato",
  concluido: "Concluído",
};

const CATEGORY_LABELS: Record<PrayerRequestRecord["categoria"], string> = {
  saude: "Saúde",
  familia: "Família",
  vida_espiritual: "Vida espiritual",
  casamento: "Casamento",
  financeiro: "Financeiro",
  ansiedade_emocional: "Ansiedade / emocional",
  outro: "Outro",
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("55")) {
    return digits;
  }

  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function PrayerRequestFollowUp({
  request,
}: {
  request: PrayerRequestRecord;
}) {
  const [state, formAction, isPending] = useActionState(
    updatePrayerRequest,
    INITIAL_PRAYER_REQUEST_ACTION_STATE,
  );

  return (
    <form className="admin-prayer-follow-up" action={formAction}>
      <input type="hidden" name="requestId" value={request.id} />

      <label>
        <span>Status</span>
        <select name="status" defaultValue={request.status}>
          <option value="novo">Novo</option>
          <option value="em_oracao">Em oração</option>
          <option value="em_contato">Em contato</option>
          <option value="concluido">Concluído</option>
        </select>
      </label>

      <label>
        <span>Responsável</span>
        <input
          type="text"
          name="responsavel"
          maxLength={120}
          defaultValue={request.responsavel ?? ""}
          placeholder="Nome de quem está acompanhando"
        />
      </label>

      <label className="admin-prayer-notes">
        <span>Observações internas</span>
        <textarea
          name="observacoes"
          maxLength={2000}
          rows={4}
          defaultValue={request.observacoes ?? ""}
          placeholder="Registre contatos e próximos passos"
        />
      </label>

      <div className="admin-prayer-save-row">
        {state.kind !== "idle" ? (
          <p data-kind={state.kind} role={state.kind === "error" ? "alert" : "status"}>
            {state.message}
          </p>
        ) : (
          <p>O pedido não pode ser apagado por este painel.</p>
        )}
        <button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar acompanhamento"}
        </button>
      </div>
    </form>
  );
}

export default function PrayerRequestsList({
  requests,
  hasLoadError,
}: PrayerRequestsListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | PrayerRequestStatus>("todos");
  const [priority, setPriority] = useState<"todos" | "urgentes" | "contato">(
    "todos",
  );
  const [openedRequestIds, setOpenedRequestIds] = useState(
    () =>
      new Set(
        requests
          .filter((request) => request.opened_at)
          .map((request) => request.id),
      ),
  );
  const [, startOpeningTransition] = useTransition();

  const normalizedQuery = normalizeText(query);
  const filteredRequests = requests.filter((request) => {
    const matchesStatus = status === "todos" || request.status === status;
    const matchesPriority =
      priority === "todos" ||
      (priority === "urgentes" && request.urgente) ||
      (priority === "contato" && request.deseja_contato);
    const searchTarget = normalizeText(
      [
        request.nome,
        request.telefone,
        request.pedido,
        CATEGORY_LABELS[request.categoria],
        request.responsavel,
      ].join(" "),
    );

    return (
      matchesStatus &&
      matchesPriority &&
      searchTarget.includes(normalizedQuery)
    );
  });

  const urgentRequests = requests.filter((request) => request.urgente).length;
  const unreadRequests = requests.filter(
    (request) => !openedRequestIds.has(request.id),
  ).length;

  function handleOpen(requestId: number, isOpen: boolean) {
    if (!isOpen || openedRequestIds.has(requestId)) {
      return;
    }

    setOpenedRequestIds((current) => new Set(current).add(requestId));
    startOpeningTransition(async () => {
      const wasSaved = await markPrayerRequestAsOpened(requestId);

      if (!wasSaved) {
        setOpenedRequestIds((current) => {
          const next = new Set(current);
          next.delete(requestId);
          return next;
        });
      }
    });
  }

  if (hasLoadError) {
    return (
      <section className="admin-visitors-state admin-visitors-error" role="alert">
        <span aria-hidden="true">!</span>
        <h2>Não foi possível carregar os pedidos.</h2>
        <p>Nenhum dado foi alterado. Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  return (
    <>
      <section className="admin-visitors-metrics" aria-label="Resumo">
        <article>
          <span>Total</span>
          <strong>{requests.length}</strong>
          <p>pedidos recebidos</p>
        </article>
        <article>
          <span>Não abertos</span>
          <strong>{unreadRequests}</strong>
          <p>pedidos para ler</p>
        </article>
        <article>
          <span>Urgentes</span>
          <strong>{urgentRequests}</strong>
          <p>marcados como prioridade</p>
        </article>
      </section>

      <section className="admin-visitors-content" aria-labelledby="prayer-list-title">
        <div className="admin-visitors-toolbar">
          <div>
            <p className="admin-visitors-label" id="prayer-list-title">
              Pedidos recebidos
            </p>
            <p>
              {filteredRequests.length}{" "}
              {filteredRequests.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>

          <div className="admin-prayer-filters">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nome, telefone ou conteúdo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "todos" | PrayerRequestStatus)
                }
              >
                <option value="todos">Todos</option>
                <option value="novo">Novos</option>
                <option value="em_oracao">Em oração</option>
                <option value="em_contato">Em contato</option>
                <option value="concluido">Concluídos</option>
              </select>
            </label>
            <label>
              <span>Prioridade</span>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as "todos" | "urgentes" | "contato",
                  )
                }
              >
                <option value="todos">Todas</option>
                <option value="urgentes">Urgentes</option>
                <option value="contato">Pediram contato</option>
              </select>
            </label>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum pedido de oração cadastrado ainda.</h2>
            <p>
              Os novos pedidos enviados pelo site aparecerão aqui
              automaticamente.
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum resultado encontrado.</h2>
            <p>Altere a busca ou os filtros para consultar outros pedidos.</p>
          </div>
        ) : (
          <div className="admin-visitors-list">
            {filteredRequests.map((request) => {
              const whatsappNumber = phoneDigits(request.telefone);

              return (
                <details
                  className="admin-visitor-card admin-prayer-card"
                  key={request.id}
                  data-urgent={request.urgente}
                  onToggle={(event) =>
                    handleOpen(request.id, event.currentTarget.open)
                  }
                >
                  <summary>
                    <span className="admin-inbox-name">{request.nome}</span>
                    <span className="admin-inbox-summary-actions">
                      {!openedRequestIds.has(request.id) ? (
                        <strong className="admin-unread-badge">Novo</strong>
                      ) : null}
                      <span className="admin-inbox-chevron" aria-hidden="true" />
                    </span>
                  </summary>
                  <header>
                    <div>
                      <span>Pedido #{request.id}</span>
                      <h2>{request.nome}</h2>
                      <p>Recebido em {formatDateTime(request.created_at)}</p>
                    </div>
                    <div className="admin-prayer-badges">
                      {request.urgente ? <strong>Urgente</strong> : null}
                      <strong data-status={request.status}>
                        {STATUS_LABELS[request.status]}
                      </strong>
                    </div>
                  </header>

                  <div className="admin-prayer-request">
                    <span>{CATEGORY_LABELS[request.categoria]}</span>
                    <p>{request.pedido}</p>
                  </div>

                  <dl className="admin-visitor-details admin-prayer-details">
                    <div>
                      <dt>WhatsApp</dt>
                      <dd>
                        <a href={`tel:${phoneDigits(request.telefone)}`}>
                          {request.telefone}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Deseja contato?</dt>
                      <dd>{request.deseja_contato ? "Sim" : "Não"}</dd>
                    </div>
                    <div>
                      <dt>Última atualização</dt>
                      <dd>{formatDateTime(request.updated_at)}</dd>
                    </div>
                  </dl>

                  <div className="admin-prayer-contact-row">
                    <span>
                      {request.deseja_contato
                        ? "A pessoa solicitou contato da equipe."
                        : "A pessoa não solicitou contato."}
                    </span>
                    <div>
                      <a href={`tel:${phoneDigits(request.telefone)}`}>Ligar</a>
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <PrayerRequestFollowUp request={request} />
                </details>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
