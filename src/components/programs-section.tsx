"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatProgramDate,
  getNextProgramDate,
  getNextSundayDate,
} from "@/lib/programs";

type CheckinAnswer = "presencial" | "nao_vou" | "live";

const programs = [
  {
    weekday: 0,
    title: "Culto Domingo na Casa",
    time: "19h",
    checkin: true,
  },
  {
    weekday: 3,
    title: "Culto Quarta de Ensino",
    time: "19h30",
    checkin: false,
  },
  {
    weekday: 5,
    title: "Sexta de Oração",
    time: "19h30",
    checkin: false,
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
  const [answer, setAnswer] = useState<CheckinAnswer | null>(null);
  const [access, setAccess] = useState<
    "loading" | "guest" | "blocked" | "member" | "error"
  >("loading");
  const [memberName, setMemberName] = useState("");
  const [saving, setSaving] = useState<CheckinAnswer | null>(null);
  const [feedback, setFeedback] = useState("");
  const schedule = useMemo(
    () =>
      programs.map((program) => {
        const date = getNextProgramDate(program.weekday);
        return { ...program, date, formattedDate: formatProgramDate(date) };
      }),
    [],
  );
  const sundayDate = getNextSundayDate();

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
          answer?: CheckinAnswer | null;
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
        setAnswer(result.answer ?? null);
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

  async function saveAnswer(nextAnswer: CheckinAnswer) {
    setSaving(nextAnswer);
    setFeedback("");

    try {
      const response = await fetch("/api/cultos/pre-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resposta: nextAnswer,
          eventDate: sundayDate,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setFeedback(result.error || "Não foi possível salvar agora.");
        return;
      }

      setAnswer(nextAnswer);
      setFeedback(result.message || "Sua resposta ficou registrada.");
    } catch {
      setFeedback("Sem conexão agora. Tente novamente em instantes.");
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
        <a href={mapsUrl} target="_blank" rel="noreferrer">
          Ver localização
          <ArrowIcon />
        </a>
      </div>

      <div className="home-program-grid">
        {schedule.map((program) => (
          <article
            className={program.checkin ? "home-program-with-checkin" : undefined}
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
            {program.checkin ? (
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
                      aria-label="Como você participará do próximo culto"
                    >
                      <button
                        type="button"
                        className={answer === "presencial" ? "is-selected" : ""}
                        aria-pressed={answer === "presencial"}
                        disabled={saving !== null}
                        onClick={() => void saveAnswer("presencial")}
                      >
                        Vou estar na Casa
                      </button>
                      <button
                        type="button"
                        className={answer === "nao_vou" ? "is-selected" : ""}
                        aria-pressed={answer === "nao_vou"}
                        disabled={saving !== null}
                        onClick={() => void saveAnswer("nao_vou")}
                      >
                        Não poderei ir
                      </button>
                      <button
                        type="button"
                        className={answer === "live" ? "is-selected" : ""}
                        aria-pressed={answer === "live"}
                        disabled={saving !== null}
                        onClick={() => void saveAnswer("live")}
                      >
                        Vou assistir pela live
                      </button>
                    </div>
                    <p className="home-checkin-feedback" aria-live="polite">
                      {saving ? "Salvando sua resposta..." : feedback}
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
