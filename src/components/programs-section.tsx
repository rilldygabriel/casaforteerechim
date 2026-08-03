"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CheckinEventKey,
  formatProgramDate,
  getNextProgramDate,
  sortProgramsByDate,
} from "@/lib/programs";

type CheckinAnswer = "presencial" | "nao_vou" | "live";

const programs = [
  {
    weekday: 0,
    title: "Culto Domingo na Casa",
    time: "19h",
    checkinKey: "domingo-casa",
  },
  {
    weekday: 3,
    title: "Culto Quarta de Ensino",
    time: "19h30",
    checkinKey: "quarta-ensino",
  },
  {
    weekday: 5,
    title: "Sexta de Oração",
    time: "19h30",
    checkinKey: null,
  },
] as const;

function CalendarIcon() {
  return (
    <svg
      className="home-calendar-icon"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect x="4.5" y="7.5" width="23" height="20" rx="4" />
      <path d="M10 4.5v6M22 4.5v6M4.5 13.5h23" />
      <path d="M10 18h3M19 18h3M10 23h3M19 23h3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

export default function ProgramsSection({ mapsUrl }: { mapsUrl: string }) {
  const [answers, setAnswers] = useState<
    Partial<Record<CheckinEventKey, CheckinAnswer>>
  >({});
  const [access, setAccess] = useState<
    "loading" | "guest" | "blocked" | "member" | "error"
  >("loading");
  const [memberName, setMemberName] = useState("");
  const [saving, setSaving] = useState<CheckinEventKey | null>(null);
  const [feedback, setFeedback] = useState<
    Partial<Record<CheckinEventKey, string>>
  >({});
  const schedule = useMemo(
    () =>
      sortProgramsByDate(
        programs.map((program) => {
          const date = getNextProgramDate(program.weekday);
          return { ...program, date, formattedDate: formatProgramDate(date) };
        }),
      ),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();

    async function loadMemberCheckin() {
      try {
        const response = await fetch("/api/cultos/pre-checkin", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          approved?: boolean;
          memberName?: string;
          answers?: Partial<Record<CheckinEventKey, CheckinAnswer>>;
        };

        if (response.status === 401) {
          setAccess("guest");
          return;
        }

        if (response.status === 403 || result.approved === false) {
          setAccess("blocked");
          return;
        }

        if (!response.ok) {
          setAccess("error");
          return;
        }

        setMemberName(result.memberName || "");
        setAnswers(result.answers ?? {});
        setAccess("member");
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setAccess("error");
        }
      }
    }

    void loadMemberCheckin();
    return () => controller.abort();
  }, []);

  async function saveAnswer(
    eventKey: CheckinEventKey,
    eventDate: string,
    nextAnswer: CheckinAnswer,
  ) {
    setSaving(eventKey);
    setFeedback((current) => ({ ...current, [eventKey]: "" }));

    try {
      const response = await fetch("/api/cultos/pre-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resposta: nextAnswer,
          eventKey,
          eventDate,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setFeedback((current) => ({
          ...current,
          [eventKey]: result.error || "Não foi possível salvar agora.",
        }));
        return;
      }

      setAnswers((current) => ({ ...current, [eventKey]: nextAnswer }));
      setFeedback((current) => ({
        ...current,
        [eventKey]: result.message || "Sua resposta ficou registrada.",
      }));
    } catch {
      setFeedback((current) => ({
        ...current,
        [eventKey]: "Sem conexão agora. Tente novamente em instantes.",
      }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section
      className="home-block home-programs"
      aria-labelledby="programs-title"
    >
      <div className="home-section-heading home-section-heading-row">
        <div>
          <p className="home-kicker">Próximos encontros</p>
          <h2 id="programs-title">Nossas programações</h2>
        </div>
        <div className="home-program-links">
          <Link href="/calendario">Calendário completo <ArrowIcon /></Link>
          <a href={mapsUrl} target="_blank" rel="noreferrer">Ver localização <ArrowIcon /></a>
        </div>
      </div>

      <div className="home-program-grid">
        {schedule.map((program) => (
          <article
            className={
              program.checkinKey ? "home-program-with-checkin" : undefined
            }
            key={program.title}
          >
            <div className="home-program-top">
              <span>{program.formattedDate}</span>
              <CalendarIcon />
            </div>
            <div className="home-program-body">
              <h3>{program.title}</h3>
              <strong>{program.time}</strong>
            </div>
            {program.checkinKey ? (
              <div className="home-checkin">
                <div>
                  <p>Pré-check-in dos membros</p>
                  <strong>
                    {access === "member" && memberName
                      ? `${memberName.split(" ")[0]}, você estará com a gente?`
                      : "Você estará com a gente?"}
                  </strong>
                </div>
                {access === "loading" ? (
                  <p className="home-checkin-status">
                    Verificando sua Área de Membro...
                  </p>
                ) : access === "guest" ? (
                  <div className="home-checkin-member-access">
                    <p>
                      Entre na sua Área de Membro para responder sem preencher
                      nome ou telefone.
                    </p>
                    <Link href="/familia/login">Entrar e responder</Link>
                  </div>
                ) : access === "blocked" ? (
                  <div className="home-checkin-member-access">
                    <p>
                      O pré-check-in será liberado assim que seu cadastro de
                      membro for aprovado.
                    </p>
                    <Link href="/familia">Ver minha área</Link>
                  </div>
                ) : access === "error" ? (
                  <p className="home-checkin-status">
                    Não foi possível verificar seu acesso agora.
                  </p>
                ) : (
                  <>
                    <div
                      className="home-checkin-options"
                      role="group"
                      aria-label={`Como você participará de ${program.title}`}
                    >
                      <button
                        type="button"
                        className={
                          answers[program.checkinKey] === "presencial"
                            ? "is-selected"
                            : ""
                        }
                        aria-pressed={
                          answers[program.checkinKey] === "presencial"
                        }
                        disabled={saving !== null}
                        onClick={() =>
                          void saveAnswer(
                            program.checkinKey,
                            program.date,
                            "presencial",
                          )
                        }
                      >
                        Vou estar na Casa
                      </button>
                      <button
                        type="button"
                        className={
                          answers[program.checkinKey] === "nao_vou"
                            ? "is-selected"
                            : ""
                        }
                        aria-pressed={answers[program.checkinKey] === "nao_vou"}
                        disabled={saving !== null}
                        onClick={() =>
                          void saveAnswer(
                            program.checkinKey,
                            program.date,
                            "nao_vou",
                          )
                        }
                      >
                        Não poderei ir
                      </button>
                      <button
                        type="button"
                        className={
                          answers[program.checkinKey] === "live"
                            ? "is-selected"
                            : ""
                        }
                        aria-pressed={answers[program.checkinKey] === "live"}
                        disabled={saving !== null}
                        onClick={() =>
                          void saveAnswer(
                            program.checkinKey,
                            program.date,
                            "live",
                          )
                        }
                      >
                        Vou assistir pela live
                      </button>
                    </div>
                    <p className="home-checkin-feedback" aria-live="polite">
                      {saving === program.checkinKey
                        ? "Salvando sua resposta..."
                        : feedback[program.checkinKey]}
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
