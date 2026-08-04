"use client";

import { useActionState } from "react";
import { resendMemberInvite, type MemberInviteResendActionState } from "../actions";
import { sendPasswordResetWhatsApp, type WhatsAppResetState } from "./actions";

const EMAIL_INITIAL: MemberInviteResendActionState = { kind: "idle", message: "" };
const WHATSAPP_INITIAL: WhatsAppResetState = { kind: "idle", message: "" };

export default function PasswordResetActions({ memberId, hasPhone }: { memberId: string; hasPhone: boolean }) {
  const [emailState, emailAction, emailPending] = useActionState(resendMemberInvite, EMAIL_INITIAL);
  const [whatsAppState, whatsAppAction, whatsAppPending] = useActionState(sendPasswordResetWhatsApp, WHATSAPP_INITIAL);
  const busy = emailPending || whatsAppPending;

  return (
    <div className="admin-password-reset-actions">
      <div>
        <span>Redefinição de senha</span>
        <h3>Enviar acesso seguro</h3>
        <p>A pessoa recebe um link temporário e cria a própria senha. A senha nunca aparece para a liderança.</p>
      </div>
      <div className="admin-password-reset-buttons">
        <form action={emailAction}><input type="hidden" name="memberId" value={memberId} /><button disabled={busy}>{emailPending ? "Enviando…" : "Enviar por e-mail"}</button></form>
        <form action={whatsAppAction}><input type="hidden" name="memberId" value={memberId} /><button disabled={busy || !hasPhone}>{whatsAppPending ? "Enviando…" : "Enviar por WhatsApp"}</button></form>
      </div>
      {emailState.message ? <p role="status" data-kind={emailState.kind}>{emailState.message}</p> : null}
      {whatsAppState.message ? <p role="status" data-kind={whatsAppState.kind}>{whatsAppState.message}</p> : null}
    </div>
  );
}
