"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AdminLoginFormProps = {
  initialError?: string;
  initialMessage?: string;
};

export default function AdminLoginForm({
  initialError = "",
  initialMessage = "",
}: AdminLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    window.location.assign("/admin");
  }

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    setMessage("");

    if (!normalizedEmail) {
      setError("Digite seu e-mail antes de solicitar uma nova senha.");
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch("/admin/recuperar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok) {
        setError(
          response.status === 429
            ? "O limite temporário de e-mails foi atingido. Não tente novamente agora."
            : "Não foi possível enviar o e-mail agora.",
        );
        return;
      }

      setMessage(
        "Se esse e-mail estiver autorizado, você receberá o link para criar uma nova senha.",
      );
    } catch {
      setError("Não foi possível enviar o e-mail agora.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
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
          Acesso restrito
        </p>
        <h1 id="admin-login-title">Painel da Casa</h1>
        <p>
          Entre com seu e-mail e senha. Somente administradores autorizados
          conseguem acessar os dados.
        </p>

        <form onSubmit={handleLogin} className="admin-auth-form">
          <label htmlFor="admin-email">E-mail</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="admin-password">Senha</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? <p className="admin-auth-error">{error}</p> : null}
          {message ? <p className="admin-auth-message">{message}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar no painel"}
          </button>
          <button
            className="admin-auth-secondary"
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
          >
            {resetLoading ? "Enviando..." : "Esqueci minha senha"}
          </button>
        </form>

        <Link className="admin-auth-back" href="/">
          Voltar ao site
        </Link>
      </section>
    </main>
  );
}
