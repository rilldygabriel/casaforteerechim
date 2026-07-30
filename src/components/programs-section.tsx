"use client";

import { useMemo, useState, type FormEvent } from "react";
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
  const [answer, setAnswer] = useState<CheckinAnswer>("presencial");
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const schedule = useMemo(
    () =>
      programs.map((program) => {
        const date = getNextProgramDate(program.weekday);
        return { ...program, date, formattedDate: formatProgramDate(date) };
      }),
    [],
  );
  const sundayDate = getNextSundayDate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/cultos/pre-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.get("nome"),
          telefone: formData.get("telefone"),
          resposta: answer,
          eventDate: sundayDate,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setState("error");
        setMessage(result.error || "Não foi possível registrar agora.");
        return;
      }

      setState("success");
      setMessage(result.message || "Pré-check-in confirmado. Esperamos você!");
    } catch {
      setState("error");
      setMessage("Sem conexão agora. Tente novamente em instantes.");
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
              <form className="home-checkin" onSubmit={handleSubmit}>
                <div>
                  <p>Pré-check-in</p>
                  <strong>Você estará com a gente?</strong>
                </div>
                <fieldset>
                  <legend>Escolha como você participará</legend>
                  <label>
                    <input
                      type="radio"
                      name="resposta"
                      checked={answer === "presencial"}
                      onChange={() => setAnswer("presencial")}
                    />
                    Eu vou
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="resposta"
                      checked={answer === "nao_vou"}
                      onChange={() => setAnswer("nao_vou")}
                    />
                    Não poderei estar
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="resposta"
                      checked={answer === "live"}
                      onChange={() => setAnswer("live")}
                    />
                    Vou assistir pela live
                  </label>
                </fieldset>
                <div className="home-checkin-fields">
                  <label>
                    Seu nome
                    <input
                      name="nome"
                      autoComplete="name"
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      name="telefone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(54) 99999-9999"
                      required
                    />
                  </label>
                </div>
                <button type="submit" disabled={state === "sending"}>
                  {state === "sending" ? "Registrando..." : "Confirmar resposta"}
                </button>
                <p
                  className="home-checkin-feedback"
                  data-kind={state}
                  aria-live="polite"
                >
                  {message}
                </p>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
