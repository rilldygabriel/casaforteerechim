"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "ragrilldy@gmail.com";

type RecoveryState = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryState, setRecoveryState] =
    useState<RecoveryState>("checking");

  useEffect(() => {
    let active = true;

    async function validateRecovery() {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const tokenHash =
        fragment.get("token_hash") ?? url.searchParams.get("token_hash");
      const recoveryType =
        fragment.get("type") ?? url.searchParams.get("type");

      if (tokenHash && recoveryType === "recovery") {
        const { data, error: verificationError } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

        url.hash = "";
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);

        if (
          verificationError ||
          data.user?.email?.trim().toLowerCase() !== ADMIN_EMAIL
        ) {
          await supabase.auth.signOut();
          if (active) {
            setRecoveryState("invalid");
          }
          return;
        }

        if (active) {
          setRecoveryState("ready");
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        setRecoveryState(
          user?.email?.trim().toLowerCase() === ADMIN_EMAIL
            ? "ready"
            : "invalid",
        );
      }
    }

    void validateRecovery();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (recoveryState !== "ready") {
      setError("Este link não está autorizado.");
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
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("O link expirou ou não é mais válido. Solicite outro.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.assign("/admin/login?mensagem=senha-atualizada");
  }

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card" aria-labelledby="reset-title">
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={220}
          height={85}
          priority
        />
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Segurança
        </p>
        <h1 id="reset-title">Crie sua nova senha</h1>
        <p>Use no mínimo oito caracteres e não compartilhe essa senha.</p>

        {recoveryState === "checking" ? (
          <p className="admin-auth-message">Validando o acesso seguro...</p>
        ) : null}

        {recoveryState === "invalid" ? (
          <>
            <p className="admin-auth-error">
              Este link expirou ou não é mais válido.
            </p>
            <Link className="admin-auth-back" href="/admin/login">
              Voltar ao login
            </Link>
          </>
        ) : null}

        {recoveryState === "ready" ? (
          <form onSubmit={handleSubmit} className="admin-auth-form">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />

            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              minLength={8}
              required
            />

            {error ? <p className="admin-auth-error">{error}</p> : null}

            <button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
