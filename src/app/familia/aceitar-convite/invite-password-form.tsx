"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type InviteState = "checking" | "ready" | "invalid";

export default function InvitePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteState, setInviteState] = useState<InviteState>("checking");

  useEffect(() => {
    let active = true;

    async function validateInvite() {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const tokenHash =
        fragment.get("token_hash") ?? url.searchParams.get("token_hash");
      const tokenType =
        fragment.get("type") ?? url.searchParams.get("type");

      if (
        tokenHash &&
        (tokenType === "invite" || tokenType === "recovery")
      ) {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tokenType,
        });

        url.hash = "";
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);

        if (verificationError) {
          await supabase.auth.signOut();
          if (active) {
            setInviteState("invalid");
          }
          return;
        }

        if (active) {
          setInviteState("ready");
        }
        return;
      }

      if (active) {
        setInviteState("invalid");
      }
    }

    void validateInvite();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (inviteState !== "ready") {
      setError("Este convite não está autorizado.");
      return;
    }

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError("O convite expirou ou não é mais válido.");
      setLoading(false);
      return;
    }

    window.location.assign("/familia");
  }

  return (
    <main className="admin-auth-page">
      <section
        className="admin-auth-card family-auth-card"
        aria-labelledby="invite-password-title"
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
          Convite aprovado
        </p>
        <h1 id="invite-password-title">Crie sua senha</h1>
        <p>Use no mínimo oito caracteres e não compartilhe essa senha.</p>

        {inviteState === "checking" ? (
          <p className="admin-auth-message">Validando seu convite...</p>
        ) : null}

        {inviteState === "invalid" ? (
          <>
            <p className="admin-auth-error" role="alert">
              Este link já foi usado ou expirou. Por segurança, cada link funciona uma única vez. Peça à liderança para enviar um novo link de acesso.
            </p>
            <Link className="admin-auth-back" href="/familia/login">
              Voltar ao acesso
            </Link>
          </>
        ) : null}

        {inviteState === "ready" ? (
          <form onSubmit={handleSubmit} className="admin-auth-form">
            <label htmlFor="member-new-password">Nova senha</label>
            <input
              id="member-new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />

            <label htmlFor="member-confirm-password">
              Confirmar nova senha
            </label>
            <input
              id="member-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
            />

            {error ? (
              <p className="admin-auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar senha e entrar"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
