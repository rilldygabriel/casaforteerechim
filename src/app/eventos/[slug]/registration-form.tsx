"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ATTENDANCE_OPTIONS, validateEncounterRegistration, validateHamburgerRegistration, validatePostEncounterRegistration, validateRegistration } from "@/lib/events";

const EventPayment = dynamic(() => import("./event-payment"), { ssr: false });

type FormState = "idle" | "sending" | "success" | "rejected" | "error";
const EMPTY = { fullName: "", email: "", phone: "", attendanceDuration: "", notes: "", consent: false, completedEncounter: "", simpleQuantity: 0, doubleQuantity: 0 };
type MemberIdentity = { fullName: string; email: string; phone: string };

export default function RegistrationForm({ slug, enabled, closedLabel = "Inscrições encerradas", feeCents = 0, variant = "standard", mercadoPagoPublicKey = "", member = null }: { slug: string; enabled: boolean; closedLabel?: string; feeCents?: number; variant?: "standard" | "post-encounter" | "encounter" | "burger"; mercadoPagoPublicKey?: string; member?: MemberIdentity | null }) {
  const storageKey = `casaforte-event-registration-${slug}`;
  const [form, setForm] = useState({ ...EMPTY, ...(member ?? {}) });
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<{ id: string; amountCents: number; fullName: string; email: string } | null>(null);
  const burgerTotalCents = form.simpleQuantity * 2000 + form.doubleQuantity * 3000;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setForm({ ...EMPTY, ...JSON.parse(saved), ...(member ?? {}), consent: false });
      } catch { /* Um rascunho inválido não impede o formulário. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [member, storageKey]);

  useEffect(() => {
    if (state !== "success") localStorage.setItem(storageKey, JSON.stringify({ ...form, consent: false }));
  }, [form, state, storageKey]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = variant === "post-encounter" ? validatePostEncounterRegistration(form) : variant === "encounter" ? validateEncounterRegistration(form) : variant === "burger" ? validateHamburgerRegistration({ fullName: form.fullName, phone: form.phone, simpleQuantity: form.simpleQuantity, doubleQuantity: form.doubleQuantity, isMember: Boolean(member) }) : validateRegistration(form);
    if (error) { setState("error"); setMessage(error); return; }
    setState("sending"); setMessage("Enviando sua inscrição…");
    try {
      const payload = variant === "burger" ? { fullName: form.fullName, phone: member ? "" : form.phone, simpleQuantity: form.simpleQuantity, doubleQuantity: form.doubleQuantity } : form;
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/inscricoes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as { error?: string; message?: string; accepted?: boolean; checkoutUrl?: string; paymentId?: string; amountCents?: number; payerName?: string; payerEmail?: string; ticketUrl?: string };
      if (!response.ok) { setState("error"); setMessage(result.error || "Não foi possível enviar."); return; }
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (result.ticketUrl) { window.location.assign(result.ticketUrl); return; }
      if (result.paymentId && result.amountCents) {
        localStorage.removeItem(storageKey);
        setPayment({ id: result.paymentId, amountCents: result.amountCents, fullName: result.payerName || form.fullName, email: result.payerEmail || form.email });
        setState("idle");
        setMessage("");
        return;
      }
      localStorage.removeItem(storageKey);
      setForm({ ...EMPTY, ...(member ?? {}) });
      setState(result.accepted === false ? "rejected" : "success");
      setMessage(result.message || "Inscrição realizada com sucesso!");
    } catch {
      setState("error"); setMessage("Sem conexão agora. Seus dados continuam salvos neste aparelho.");
    }
  }

  function changeBurgerQuantity(field: "simpleQuantity" | "doubleQuantity", delta: -1 | 1) {
    setForm((current) => {
      const nextValue = Math.max(0, current[field] + delta);
      const otherValue = field === "simpleQuantity" ? current.doubleQuantity : current.simpleQuantity;
      if (nextValue + otherValue > 100) return current;
      return { ...current, [field]: nextValue };
    });
  }

  if (!enabled) return <div className="event-registration-closed"><strong>{closedLabel}</strong><p>{variant === "burger" && closedLabel === "Hambúrgueres esgotados" ? "As 100 unidades já foram reservadas e as vendas foram encerradas." : "Este evento não está recebendo novas inscrições."}</p></div>;
  if (payment) return <EventPayment slug={slug} paymentId={payment.id} amountCents={payment.amountCents} fullName={payment.fullName} email={payment.email} publicKey={mercadoPagoPublicKey} maxInstallments={variant === "burger" ? 1 : 4} />;
  if (state === "success") return <div className="event-registration-success" role="status"><span aria-hidden="true">✓</span><h2>Inscrição confirmada</h2><p>{message}</p></div>;
  if (state === "rejected") return <div className="event-registration-rejected" role="status"><span aria-hidden="true">!</span><h2>Inscrição não aceita</h2><p>{message}</p></div>;

  return <form className={`event-registration-form${variant === "burger" ? " is-burger" : ""}`} onSubmit={submit}>
    {variant !== "burger" ? <><label>Nome completo<input required minLength={3} maxLength={160} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>E-mail{feeCents > 0 ? null : <small> Opcional</small>}<input required={feeCents > 0} type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Telefone ou WhatsApp<input required inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></> : <><label>Nome de quem fará a retirada<input required minLength={3} maxLength={160} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>{!member ? <label>Seu WhatsApp<input required inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label> : null}</>}
    {variant === "post-encounter" ? <fieldset className="event-eligibility"><legend>Você fez o Encontro com Deus na Casa?</legend><label><input required type="radio" name="completedEncounter" value="yes" checked={form.completedEncounter === "yes"} onChange={(event) => setForm({ ...form, completedEncounter: event.target.value, consent: true })} /> Sim, eu fiz</label><label><input required type="radio" name="completedEncounter" value="no" checked={form.completedEncounter === "no"} onChange={(event) => setForm({ ...form, completedEncounter: event.target.value, consent: true })} /> Não fiz</label></fieldset> : variant === "encounter" ? <p className="event-payment-notice">Valor: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(feeCents / 100)}</strong>. Pague por Pix ou cartão em até 4 vezes. Ao continuar, você autoriza o uso dos dados para organizar o evento e confirmar sua inscrição.</p> : variant === "burger" ? <><fieldset className="burger-options"><legend>Escolha a quantidade</legend><label><span><strong>Simples</strong><small>R$ 20 cada</small></span><span className="burger-stepper"><button type="button" aria-label="Diminuir hambúrguer simples" disabled={form.simpleQuantity === 0} onClick={() => changeBurgerQuantity("simpleQuantity", -1)}>−</button><output aria-label={`${form.simpleQuantity} hambúrgueres simples`}>{form.simpleQuantity}</output><button type="button" aria-label="Adicionar hambúrguer simples" disabled={form.simpleQuantity + form.doubleQuantity >= 100} onClick={() => changeBurgerQuantity("simpleQuantity", 1)}>+</button></span></label><label><span><strong>Duplo</strong><small>R$ 30 cada</small></span><span className="burger-stepper"><button type="button" aria-label="Diminuir hambúrguer duplo" disabled={form.doubleQuantity === 0} onClick={() => changeBurgerQuantity("doubleQuantity", -1)}>−</button><output aria-label={`${form.doubleQuantity} hambúrgueres duplos`}>{form.doubleQuantity}</output><button type="button" aria-label="Adicionar hambúrguer duplo" disabled={form.simpleQuantity + form.doubleQuantity >= 100} onClick={() => changeBurgerQuantity("doubleQuantity", 1)}>+</button></span></label><div><span>Total</span><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(burgerTotalCents / 100)}</strong></div></fieldset><p className="burger-payment-short">Pix ou cartão em 1 vez</p></> : <><label>Há quanto tempo frequenta a Casa?<select required value={form.attendanceDuration} onChange={(event) => setForm({ ...form, attendanceDuration: event.target.value })}><option value="">Selecione uma opção</option>{ATTENDANCE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Observações <small>Opcional</small><textarea maxLength={1500} rows={5} placeholder="Se desejar, conte algo importante para nossa equipe." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="event-consent"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>Autorizo o uso das informações fornecidas exclusivamente para contato e organização deste evento.</span></label></>}
    {message ? <p className="event-form-message" data-state={state} role="status">{message}</p> : null}
    <button type="submit" disabled={state === "sending" || (variant === "burger" && burgerTotalCents === 0)}>{state === "sending" ? "Abrindo pagamento…" : variant === "burger" ? `Ir para pagamento · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(burgerTotalCents / 100)}` : feeCents > 0 ? `Inscrever e escolher pagamento · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(feeCents / 100)}` : "Enviar inscrição"}</button>
  </form>;
}
