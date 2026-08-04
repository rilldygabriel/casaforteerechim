"use client";

import { useEffect, useState } from "react";
import { ATTENDANCE_OPTIONS, validateRegistration } from "@/lib/events";

type FormState = "idle" | "sending" | "success" | "error";
const EMPTY = { fullName: "", phone: "", attendanceDuration: "", notes: "", consent: false };

export default function RegistrationForm({ slug, enabled }: { slug: string; enabled: boolean }) {
  const storageKey = `casaforte-event-registration-${slug}`;
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setForm({ ...EMPTY, ...JSON.parse(saved), consent: false });
      } catch { /* Um rascunho inválido não impede o formulário. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (state !== "success") localStorage.setItem(storageKey, JSON.stringify({ ...form, consent: false }));
  }, [form, state, storageKey]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateRegistration(form);
    if (error) { setState("error"); setMessage(error); return; }
    setState("sending"); setMessage("Enviando sua inscrição…");
    try {
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/inscricoes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) { setState("error"); setMessage(result.error || "Não foi possível enviar."); return; }
      localStorage.removeItem(storageKey);
      setForm(EMPTY);
      setState("success");
      setMessage(result.message || "Inscrição realizada com sucesso!");
    } catch {
      setState("error"); setMessage("Sem conexão agora. Seus dados continuam salvos neste aparelho.");
    }
  }

  if (!enabled) return <div className="event-registration-closed"><strong>Inscrições indisponíveis</strong><p>Este evento não está recebendo novas inscrições.</p></div>;
  if (state === "success") return <div className="event-registration-success" role="status"><span aria-hidden="true">✓</span><h2>Inscrição confirmada</h2><p>{message}</p></div>;

  return <form className="event-registration-form" onSubmit={submit}>
    <label>Nome completo<input required minLength={3} maxLength={160} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
    <label>Telefone ou WhatsApp<input required inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label>Há quanto tempo frequenta a Casa?<select required value={form.attendanceDuration} onChange={(event) => setForm({ ...form, attendanceDuration: event.target.value })}><option value="">Selecione uma opção</option>{ATTENDANCE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Observações <small>Opcional</small><textarea maxLength={1500} rows={5} placeholder="Se desejar, conte algo importante para nossa equipe." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    <label className="event-consent"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>Autorizo o uso das informações fornecidas exclusivamente para contato e organização deste evento.</span></label>
    {message ? <p className="event-form-message" data-state={state} role="status">{message}</p> : null}
    <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Enviar inscrição"}</button>
  </form>;
}
