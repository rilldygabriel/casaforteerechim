"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function MemberSignupForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (normalizedName.length < 3 || normalizedName.length > 160) {
      setError("Digite seu nome completo.");
      return;
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Digite um WhatsApp válido, com DDD.");
      return;
    }

    setLoading(true);
    let response: Response;

    try {
      response = await fetch("/api/membros/solicitar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
        }),
      });
    } catch {
      setError("Não foi possível criar seu acesso agora.");
      setLoading(false);
      return;
    }

    if (!response.ok) {
      setError(
        response.status === 400
          ? "Revise os dados preenchidos."
          : response.status === 429
            ? "Aguarde um minuto antes de tentar novamente."
            : "Não foi possível criar seu acesso agora.",
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="admin-auth-page">
        <section className="admin-auth-card family-auth-card family-signup-success">
          <Link href="/" aria-label="Voltar para o site da Casa Forte">
            <Image
              src="/images/logo-casa-forte.png"
              alt="Igreja Casa Forte"
              width={220}
              height={85}
              priority
            />
          </Link>
          <span className="success-mark" aria-hidden="true">
            ✓
          </span>
          <h1>Cadastro realizado.</h1>
          <p>
            Enviamos agora o convite para o seu e-mail. Abra a mensagem e crie
            sua senha para entrar na Área da Família.
          </p>
          <Link className="family-auth-primary-link" href="/familia/login">
            Ir para o acesso
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-auth-page">
      <section
        className="admin-auth-card family-auth-card family-signup-card"
        aria-labelledby="member-signup-title"
      >
        <Link href="/" aria-label="Voltar para o site da Casa Forte">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={220}
            height={85}
            priority
          />
        </Link>

        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Cadastro da Família
        </p>
        <h1 id="member-signup-title">Quero fazer parte.</h1>
        <p>
          Preencha seus dados e enviaremos imediatamente o convite para você
          criar sua senha e entrar na Área da Família.
        </p>

        <form onSubmit={handleSignup} className="admin-auth-form">
          <div className="family-signup-grid">
            <label className="family-signup-field-wide" htmlFor="member-name">
              Nome completo
              <input
                id="member-name"
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={160}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>

            <label htmlFor="member-phone">
              WhatsApp
              <input
                id="member-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={30}
                placeholder="(54) 99999-9999"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </label>

            <label htmlFor="member-signup-email">
              E-mail
              <input
                id="member-signup-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          </div>

          {error ? (
            <p className="admin-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? "Criando seu acesso..." : "Criar meu acesso"}
          </button>
        </form>

        <p className="family-auth-register">
          Já tem acesso? <Link href="/familia/login">Entrar</Link>
        </p>
        <Link className="admin-auth-back" href="/">
          Voltar ao site
        </Link>
      </section>
    </main>
  );
}
