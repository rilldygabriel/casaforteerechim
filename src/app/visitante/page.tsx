"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

const SUPABASE_URL = "https://mfqlmsisrceyajspeeav.supabase.co";
const SUPABASE_KEY = "sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE";
const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";

export default function Visitante() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get("nome") || "").trim(),
      telefone: String(form.get("telefone") || "").trim(),
      cidade: String(form.get("cidade") || "").trim(),
      bairro: String(form.get("bairro") || "").trim(),
      acompanhamento: form.get("suporteLider") === "Sim",
      convidado_por: String(form.get("convidadoPor") || "").trim() || null,
      igreja_anterior:
        String(form.get("igrejaAnterior") || "").trim() || null,
      passo_fe: form.get("passoFe"),
      mensagem_pastor: form.get("mensagemPastor") === "Sim",
      experiencia_culto: form.get("experienciaCulto"),
      voltar_culto: form.get("voltarCasa"),
      data_visita: new Date().toISOString().slice(0, 10),
      status_acompanhamento: "novo",
    };

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/visitantes`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Falha ao salvar");
      event.currentTarget.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="inner-page visitor-page">
      <header className="inner-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={180}
            height={70}
          />
        </Link>
        <Link className="inner-back" href="/">
          Voltar ao site
        </Link>
      </header>

      <section className="form-layout">
        <div className="form-intro">
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            Sou visitante
          </p>
          <h1>
            Queremos
            <strong>conhecer você.</strong>
          </h1>
          <p>
            Preencha esta ficha de acolhimento. Nossa equipe vai receber seus
            dados e acompanhar o seu próximo passo na Casa.
          </p>
        </div>

        {state === "success" ? (
          <div className="visitor-success">
            <span className="success-mark">✓</span>
            <p className="path-kicker">Cadastro concluído</p>
            <h2>Você já faz parte da Casa!</h2>
            <p>
              Seja muito bem-vindo. Entre agora no grupo oficial para
              acompanhar os avisos e caminhar conosco.
            </p>
            <a
              className="button button-primary"
              href={GROUP_URL}
              target="_blank"
              rel="noreferrer"
            >
              Entrar no grupo da Casa
            </a>
          </div>
        ) : (
          <form className="visitor-form" onSubmit={submit}>
            <label>Nome completo<input name="nome" required /></label>
            <label>Telefone<input name="telefone" type="tel" required /></label>
            <div className="form-row">
              <label>Cidade<input name="cidade" required /></label>
              <label>Bairro<input name="bairro" required /></label>
            </div>
            <label>Quem convidou você?<input name="convidadoPor" /></label>
            <label>Igreja anterior, se houver<input name="igrejaAnterior" /></label>

            <fieldset>
              <legend>Gostaria de suporte de um líder?</legend>
              <label className="choice"><input type="radio" name="suporteLider" value="Sim" required /> Sim</label>
              <label className="choice"><input type="radio" name="suporteLider" value="Não" /> Não</label>
            </fieldset>
            <fieldset>
              <legend>Onde está o seu passo de fé?</legend>
              <label className="choice"><input type="radio" name="passoFe" value="aceitei_jesus" required /> Aceitei Jesus</label>
              <label className="choice"><input type="radio" name="passoFe" value="batizado" /> Sou batizado</label>
              <label className="choice"><input type="radio" name="passoFe" value="caminhada_longa" /> Já tenho uma caminhada longa na fé</label>
              <label className="choice"><input type="radio" name="passoFe" value="conhecendo" /> Sou novo, conhecendo ainda</label>
            </fieldset>
            <fieldset>
              <legend>Gostaria de receber uma mensagem do Pastor?</legend>
              <label className="choice"><input type="radio" name="mensagemPastor" value="Sim" required /> Sim</label>
              <label className="choice"><input type="radio" name="mensagemPastor" value="Não" /> Não</label>
            </fieldset>
            <fieldset>
              <legend>Como foi sua experiência no culto?</legend>
              <label className="choice"><input type="radio" name="experienciaCulto" value="ruim" required /> Ruim</label>
              <label className="choice"><input type="radio" name="experienciaCulto" value="boa" /> Boa</label>
              <label className="choice"><input type="radio" name="experienciaCulto" value="ótima" /> Ótima</label>
            </fieldset>
            <fieldset>
              <legend>Você sentiu vontade de voltar à Casa?</legend>
              <label className="choice"><input type="radio" name="voltarCasa" value="Sim, estarei no próximo culto" required /> Sim, estarei no próximo culto</label>
              <label className="choice"><input type="radio" name="voltarCasa" value="Não, fui só visitar" /> Não, fui só visitar</label>
            </fieldset>

            <button className="button button-primary form-submit" disabled={state === "sending"}>
              {state === "sending" ? "Enviando..." : "Enviar ficha de visitante"}
            </button>
            {state === "error" && (
              <p className="form-error">
                Não foi possível enviar agora. Confira sua conexão e tente
                novamente.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
