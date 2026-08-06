"use client";

import { FormEvent, useState } from "react";

export default function CompleteGoogleSignupForm({
  initialName,
}: {
  initialName: string;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    const phoneDigits = phone.replace(/\D/g, "");

    if (normalizedName.length < 3 || normalizedName.length > 160) {
      setError("Digite seu nome completo.");
      return;
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Digite um WhatsApp válido, com DDD.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/membros/completar-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: normalizedName, phone }),
      });

      if (!response.ok) {
        throw new Error("request_failed");
      }

      window.location.href = "/familia";
    } catch {
      setError("Não foi possível salvar agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-auth-form">
      <label htmlFor="google-member-name">Nome completo</label>
      <input
        id="google-member-name"
        name="fullName"
        type="text"
        autoComplete="name"
        maxLength={160}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
      />

      <label htmlFor="google-member-phone">WhatsApp</label>
      <input
        id="google-member-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={30}
        placeholder="(54) 99999-9999"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        required
      />

      {error ? (
        <p className="admin-auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Concluir meu cadastro"}
      </button>
    </form>
  );
}
