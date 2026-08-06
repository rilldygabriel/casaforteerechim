"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type GoogleAuthButtonProps = {
  mode: "login" | "signup";
};

export default function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleAuth() {
    setLoading(true);
    setError("");

    try {
      const next = mode === "signup" ? "/familia/completar-cadastro" : "/familia";
      const callback = new URL("/familia/callback", window.location.origin);
      callback.searchParams.set("next", next);

      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (authError) {
        throw authError;
      }
    } catch {
      setError("Não foi possível abrir o Google agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="family-google-auth">
      <button
        className="family-google-button"
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
      >
        <span className="family-google-mark" aria-hidden="true">
          G
        </span>
        {loading
          ? "Abrindo o Google..."
          : mode === "signup"
            ? "Cadastrar com Google"
            : "Entrar com Google"}
      </button>
      {error ? (
        <p className="admin-auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
