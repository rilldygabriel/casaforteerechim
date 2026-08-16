"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendFamilyAnnouncement, type AnnouncementState } from "./actions";

const INITIAL: AnnouncementState = { kind: "idle", message: "" };

export default function AnnouncementForm() {
  const [state, action, pending] = useActionState(sendFamilyAnnouncement, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.kind === "success") formRef.current?.reset(); }, [state]);

  return (
    <form className="admin-announcement-form" action={action} ref={formRef}>
      <label>Título<input name="title" required minLength={3} maxLength={100} placeholder="Ex.: Encontro especial nesta sexta" /></label>
      <label>Mensagem<textarea name="body" required minLength={3} maxLength={2000} rows={7} placeholder="Escreva a mensagem que todos os membros receberão…" /></label>
      <label className="admin-announcement-channel">
        <input type="checkbox" name="sendWhatsApp" />
        <span>Enviar também pela API oficial do WhatsApp</span>
      </label>
      <button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar para todos"}</button>
      {state.message ? <p className="admin-announcement-feedback" data-kind={state.kind}>{state.message}</p> : null}
    </form>
  );
}
