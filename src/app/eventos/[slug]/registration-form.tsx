"use client";

import { useEffect, useState } from "react";
import { ATTENDANCE_OPTIONS, validatePostEncounterRegistration, validateRegistration } from "@/lib/events";

type FormState = "idle" | "sending" | "success" | "rejected" | "error";
const EMPTY = { fullName: "", email: "", phone: "", attendanceDuration: "", notes: "", consent: false, completedEncounter: "" };

export default function RegistrationForm({ slug, enabled, feeCents = 0, variant = "standard" }: { slug: string; enabled: boolean; feeCents?: number; variant?: "standard" | "post-encounter" }) {
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
    const error = variant === "post-encounter" ? validatePostEncounterRegistration(form) : validateRegistration(form);
    if (error) { setState("error"); setMessage(error); return; }
    setState("sending"); setMessage("Enviando sua inscrição…");
    try {
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/inscricoes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = (await response.json()) as { error?: string; message?: string; accepted?: boolean; checkoutUrl?: string };
      if (!response.ok) { setState("error"); setMessage(result.error || "Não foi possível enviar."); return; }
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      localStorage.removeItem(storageKey);
      setForm(EMPTY);
      setState(result.accepted === false ? "rejected" : "success");
      setMessage(result.message || "Inscrição realizada com sucesso!");
    } catch {
      setState("error"); setMessage("Sem conexão agora. Seus dados continuam salvos neste aparelho.");
    }
  }

  if (!enabled) return <div className="event-registration-closed"><strong>Inscrições indisponíveis</strong><p>Este evento não está recebendo novas inscrições.</p></div>;
  if (state === "success") return <div className="event-registration-success" role="status"><span aria-hidden="true">✓</span><h2>Inscrição confirmada</h2><p>{message}</p></div>;
  if (state === "rejected") return <div className="event-registration-rejected" role="status"><span aria-hidden="true">!</span><h2>Inscrição não aceita</h2><p>{message}</p></div>;

  return <form className="event-registration-form" onSubmit={submit}>
    <label>Nome completo<input required minLength={3} maxLength={160} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
    <label>E-mail{feeCents > 0 ? null : <small> Opcional</small>}<input required={feeCents > 0} type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
    <label>Telefone ou WhatsApp<input required inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    {variant === "post-encounter" ? <fieldset className="event-eligibility"><legend>Você fez o Encontro com Deus na Casa?</legend><label><input required type="radio" name="completedEncounter" value="yes" checked={form.completedEncounter === "yes"} onChange={(event) => setForm({ ...form, completedEncounter: event.target.value, consent: true })} /> Sim, eu fiz</label><label><input required type="radio" name="completedEncounter" value="no" checked={form.completedEncounter === "no"} onChange={(event) => setForm({ ...form, completedEncounter: event.target.value, consent: true })} /> Não fiz</label></fieldset> : <><label>Há quanto tempo frequenta a Casa?<select required value={form.attendanceDuration} onChange={(event) => setForm({ ...form, attendanceDuration: event.target.value })}><option value="">Selecione uma opção</option>{ATTENDANCE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Observações <small>Opcional</small><textarea maxLength={1500} rows={5} placeholder="Se desejar, conte algo importante para nossa equipe." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="event-consent"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>Autorizo o uso das informações fornecidas exclusivamente para contato e organização deste evento.</span></label></>}
    {message ? <p className="event-form-message" data-state={state} role="status">{message}</p> : null}
    <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : feeCents > 0 ? `Continuar para pagamento · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(feeCents / 100)}` : "Enviar inscrição"}</button>
  </form>;
}
