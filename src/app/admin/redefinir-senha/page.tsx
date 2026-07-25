"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
      </section>
    </main>
  );
}
