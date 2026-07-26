"use client";

import { useState } from "react";

export type VisitorRecord = {
  id: number;
  nome: string;
  telefone: string;
  cidade: string;
  bairro: string;
  acompanhamento: boolean;
  convidado_por: string | null;
  igreja_anterior: string | null;
  passo_fe:
    | "aceitei_jesus"
    | "batizado"
    | "caminhada_longa"
    | "conhecendo";
  mensagem_pastor: boolean;
  experiencia_culto: "ruim" | "boa" | "ótima";
  voltar_culto:
    | "Sim, estarei no próximo culto"
    | "Não, fui só visitar";
  data_visita: string;
  status_acompanhamento: "novo" | "em_contato" | "acompanhado" | "concluido";
  created_at: string;
};

type VisitorsListProps = {
  visitors: VisitorRecord[];
  hasLoadError: boolean;
};

const STATUS_LABELS: Record<VisitorRecord["status_acompanhamento"], string> = {
  novo: "Novo",
  em_contato: "Em contato",
  acompanhado: "Acompanhado",
  concluido: "Concluído",
};

const FAITH_STEP_LABELS: Record<VisitorRecord["passo_fe"], string> = {
  aceitei_jesus: "Aceitou Jesus",
  batizado: "Já é batizado",
  caminhada_longa: "Caminhada longa na fé",
  conhecendo: "Está conhecendo a fé",
};

const EXPERIENCE_LABELS: Record<VisitorRecord["experiencia_culto"], string> = {
  ruim: "Ruim",
  boa: "Boa",
  ótima: "Ótima",
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatVisitDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export default function VisitorsList({
  visitors,
  hasLoadError,
}: VisitorsListProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | VisitorRecord["status_acompanhamento"]>(
    "todos",
  );

  const normalizedQuery = normalizeText(query);
  const filteredVisitors = visitors.filter((visitor) => {
    const matchesStatus =
      status === "todos" || visitor.status_acompanhamento === status;
    const searchTarget = normalizeText(
      [
        visitor.nome,
        visitor.telefone,
        visitor.cidade,
        visitor.bairro,
        visitor.convidado_por,
      ].join(" "),
    );

    return matchesStatus && searchTarget.includes(normalizedQuery);
  });

  const newVisitors = visitors.filter(
    (visitor) => visitor.status_acompanhamento === "novo",
  ).length;
  const followUpRequests = visitors.filter(
    (visitor) => visitor.acompanhamento || visitor.mensagem_pastor,
  ).length;

  if (hasLoadError) {
    return (
      <section className="admin-visitors-state admin-visitors-error" role="alert">
        <span aria-hidden="true">!</span>
        <h2>Não foi possível carregar as fichas.</h2>
        <p>Nenhum dado foi alterado. Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  return (
    <>
      <section className="admin-visitors-metrics" aria-label="Resumo">
        <article>
          <span>Total</span>
          <strong>{visitors.length}</strong>
          <p>fichas recebidas</p>
        </article>
        <article>
          <span>Novos</span>
          <strong>{newVisitors}</strong>
          <p>aguardando contato</p>
        </article>
        <article>
          <span>Prioridade</span>
          <strong>{followUpRequests}</strong>
          <p>pediram acompanhamento</p>
        </article>
      </section>

      <section className="admin-visitors-content" aria-labelledby="visitor-list-title">
        <div className="admin-visitors-toolbar">
          <div>
            <p className="admin-visitors-label" id="visitor-list-title">
              Fichas de visitantes
            </p>
            <p>
              {filteredVisitors.length}{" "}
              {filteredVisitors.length === 1 ? "resultado" : "resultados"}
            </p>
          </div>

          <div className="admin-visitors-filters">
            <label>
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nome, telefone ou cidade"
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
                      | VisitorRecord["status_acompanhamento"],
                  )
                }
              >
                <option value="todos">Todos</option>
                <option value="novo">Novos</option>
                <option value="em_contato">Em contato</option>
                <option value="acompanhado">Acompanhados</option>
                <option value="concluido">Concluídos</option>
              </select>
            </label>
          </div>
        </div>

        {visitors.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum visitante cadastrado ainda.</h2>
            <p>As novas fichas enviadas pelo site aparecerão aqui automaticamente.</p>
          </div>
        ) : filteredVisitors.length === 0 ? (
          <div className="admin-visitors-state">
            <span aria-hidden="true">0</span>
            <h2>Nenhum resultado encontrado.</h2>
            <p>Altere a busca ou o filtro de status para ver outras fichas.</p>
          </div>
        ) : (
          <div className="admin-visitors-list">
            {filteredVisitors.map((visitor) => {
              const whatsappNumber = phoneDigits(visitor.telefone);

              return (
                <article className="admin-visitor-card" key={visitor.id}>
                  <header>
                    <div>
                      <span>Visitante #{visitor.id}</span>
                      <h2>{visitor.nome}</h2>
                      <p>
                        {visitor.cidade} · {visitor.bairro}
                      </p>
                    </div>
                    <strong data-status={visitor.status_acompanhamento}>
                      {STATUS_LABELS[visitor.status_acompanhamento]}
                    </strong>
                  </header>

                  <dl className="admin-visitor-details">
                    <div>
                      <dt>Telefone</dt>
                      <dd>
                        <a href={`tel:${phoneDigits(visitor.telefone)}`}>
                          {visitor.telefone}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt>Data da visita</dt>
                      <dd>{formatVisitDate(visitor.data_visita)}</dd>
                    </div>
                    <div>
                      <dt>Passo de fé</dt>
                      <dd>{FAITH_STEP_LABELS[visitor.passo_fe]}</dd>
                    </div>
                    <div>
                      <dt>Experiência no culto</dt>
                      <dd>{EXPERIENCE_LABELS[visitor.experiencia_culto]}</dd>
                    </div>
                    <div>
                      <dt>Convidado por</dt>
                      <dd>{visitor.convidado_por || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt>Igreja anterior</dt>
                      <dd>{visitor.igreja_anterior || "Não informado"}</dd>
                    </div>
                    <div className="admin-visitor-detail-wide">
                      <dt>Deseja voltar?</dt>
                      <dd>{visitor.voltar_culto}</dd>
                    </div>
                  </dl>

                  <div className="admin-visitor-flags" aria-label="Solicitações">
                    <span data-active={visitor.acompanhamento}>
                      {visitor.acompanhamento
                        ? "Solicitou apoio de um líder"
                        : "Não solicitou apoio de líder"}
                    </span>
                    <span data-active={visitor.mensagem_pastor}>
                      {visitor.mensagem_pastor
                        ? "Solicitou mensagem do pastor"
                        : "Não solicitou mensagem do pastor"}
                    </span>
                  </div>

                  <footer>
                    <small>Recebido em {formatCreatedAt(visitor.created_at)}</small>
                    <div>
                      <a href={`tel:${phoneDigits(visitor.telefone)}`}>
                        Ligar
                      </a>
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
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
