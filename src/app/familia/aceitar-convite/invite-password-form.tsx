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
  const [tokenHash, setTokenHash] = useState("");
  const [tokenType, setTokenType] = useState<"invite" | "recovery" | null>(null);
  const [verified, setVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function prepareInvite() {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const nextTokenHash =
        fragment.get("token_hash") ?? url.searchParams.get("token_hash");
      const nextTokenType =
        fragment.get("type") ?? url.searchParams.get("type");

      if (
        nextTokenHash &&
        (nextTokenType === "invite" || nextTokenType === "recovery")
      ) {
        if (active) {
          setTokenHash(nextTokenHash);
          setTokenType(nextTokenType);
          setInviteState("ready");
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setVerified(true);
        setInviteState("ready");
      } else {
        setInviteState("invalid");
      }
    }

    void prepareInvite();

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
    if (!verified) {
      if (!tokenHash || !tokenType) {
        setInviteState("invalid");
        setLoading(false);
        return;
      }

      const { error: verificationError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType,
      });
      if (verificationError) {
        console.error("member_invite_verification_failed", verificationError.code);
        setInviteState("invalid");
        setLoading(false);
        return;
      }
      setVerified(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error("member_invite_password_update_failed", updateError.code);
      setError("Não foi possível salvar a senha. Confira os dados e tente novamente.");
      setLoading(false);
      return;
    }

    window.history.replaceState(null, "", "/familia/aceitar-convite");
    window.location.assign("/familia");
  }

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendMessage("");
    setResendLoading(true);
    try {
      const response = await fetch("/api/membros/reenviar-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });
      setResendMessage(response.status === 429
        ? "Um novo link já foi solicitado. Aguarde um minuto e confira seu e-mail e WhatsApp."
        : response.ok
          ? "Se o e-mail estiver cadastrado, um novo link foi enviado por e-mail e WhatsApp."
          : "Não foi possível enviar agora. Tente novamente em alguns minutos.");
    } catch {
      setResendMessage("Não foi possível enviar agora. Verifique sua internet e tente novamente.");
    } finally {
      setResendLoading(false);
    }
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
              Este link já foi usado ou passou do prazo. Você pode receber outro agora, sem precisar falar com a liderança.
            </p>
            <form onSubmit={handleResend} className="admin-auth-form">
              <label htmlFor="member-resend-email">Seu e-mail cadastrado</label>
              <input id="member-resend-email" type="email" autoComplete="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} required />
              {resendMessage ? <p className="admin-auth-message" role="status">{resendMessage}</p> : null}
              <button type="submit" disabled={resendLoading}>{resendLoading ? "Enviando..." : "Receber novo link"}</button>
            </form>
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
