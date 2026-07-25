"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type PrayerFormProps = {
  placement?: "home" | "page";
};

export default function PrayerForm({
  placement = "page",
}: PrayerFormProps) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      nome: String(form.get("nome") || "").trim(),
      telefone: String(form.get("telefone") || "").trim(),
      categoria: form.get("categoria"),
      pedido: String(form.get("pedido") || "").trim(),
      deseja_contato: form.get("desejaContato") === "Sim",
    };

    try {
      const response = await fetch("/api/oracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Falha ao salvar");

      formElement.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        className={`visitor-success ${
          placement === "home" ? "home-prayer-success" : ""
        }`}
        role="status"
      >
        <span className="success-mark">✓</span>
        <p className="path-kicker">Pedido recebido</p>
        <h2>Estamos orando por você.</h2>
        <p>
          Nossa equipe recebeu sua mensagem. Você não está sozinho nessa
          caminhada.
        </p>
        {placement === "home" ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => setState("idle")}
          >
            Enviar outro pedido
          </button>
        ) : (
          <Link className="button button-primary" href="/">
            Voltar para o site
          </Link>
        )}
      </div>
    );
  }

  return (
    <form
      className={`visitor-form ${
        placement === "home" ? "home-prayer-form" : ""
      }`}
      onSubmit={submit}
    >
      <label>
        Nome completo
        <input name="nome" autoComplete="name" minLength={3} required />
      </label>
      <label>
        Número de WhatsApp
        <input
          name="telefone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          minLength={8}
          required
        />
      </label>
      <label>
        Motivo do pedido de oração
        <select name="categoria" required defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          <option value="saude">Saúde</option>
          <option value="familia">Família</option>
          <option value="vida_espiritual">Vida espiritual</option>
          <option value="casamento">Casamento</option>
          <option value="financeiro">Financeiro</option>
          <option value="ansiedade_emocional">Ansiedade e emocional</option>
          <option value="outro">Outro</option>
        </select>
      </label>
      <label>
        Escreva seu pedido de oração
        <textarea name="pedido" rows={placement === "home" ? 5 : 7} required />
      </label>
      <fieldset>
        <legend>Gostaria que alguém da nossa equipe entrasse em contato?</legend>
        <label className="choice">
          <input type="radio" name="desejaContato" value="Sim" required /> Sim
        </label>
        <label className="choice">
          <input type="radio" name="desejaContato" value="Não" /> Não
        </label>
      </fieldset>
      <button
        className="button button-primary form-submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "Enviando..." : "Enviar pedido de oração"}
      </button>
      {state === "error" && (
        <p className="form-error" role="alert">
          Não foi possível enviar agora. Confira sua conexão e tente novamente.
        </p>
      )}
    </form>
  );
}
