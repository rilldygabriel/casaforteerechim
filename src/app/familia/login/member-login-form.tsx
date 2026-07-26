"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MemberLoginFormProps = {
  initialError?: string;
};

export default function MemberLoginForm({
  initialError = "",
}: MemberLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(
        signInError.code === "email_not_confirmed"
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos.",
      );
      setLoading(false);
      return;
    }

    window.location.assign("/familia");
  }

  return (
    <main className="admin-auth-page">
      <section
        className="admin-auth-card family-auth-card"
        aria-labelledby="member-login-title"
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
          Área da Família
        </p>
        <h1 id="member-login-title">Entre em casa.</h1>
        <p>
          Use seu e-mail e senha. O conteúdo da Família é liberado depois da
          aprovação do seu cadastro.
        </p>

        <form onSubmit={handleLogin} className="admin-auth-form">
          <label htmlFor="member-email">E-mail</label>
          <input
            id="member-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="member-password">Senha</label>
          <input
            id="member-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <p className="admin-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar na Família"}
          </button>
        </form>

        <p className="family-auth-register">
          Ainda não tem acesso?{" "}
          <Link href="/familia/cadastro">Enviar solicitação</Link>
        </p>
        <Link className="admin-auth-back" href="/">
          Voltar ao site
        </Link>
      </section>
    </main>
  );
}
