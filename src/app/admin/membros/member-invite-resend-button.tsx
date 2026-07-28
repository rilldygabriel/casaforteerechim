"use client";

import { useActionState } from "react";
import {
  resendMemberInvite,
  type MemberInviteResendActionState,
} from "./actions";

const INITIAL_RESEND_STATE: MemberInviteResendActionState = {
  kind: "idle",
  message: "",
};

type MemberInviteResendButtonProps = {
  memberId: string;
  memberName: string;
};

export default function MemberInviteResendButton({
  memberId,
  memberName,
}: MemberInviteResendButtonProps) {
  const [state, formAction, pending] = useActionState(
    resendMemberInvite,
    INITIAL_RESEND_STATE,
  );

  return (
    <form action={formAction} className="admin-member-resend">
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        disabled={pending || state.kind === "success"}
        aria-label={`Reenviar e-mail de acesso para ${memberName}`}
      >
        {pending ? "Enviando…" : "Reenviar e-mail"}
      </button>
      {state.message ? (
        <p role="status" aria-live="polite" data-kind={state.kind}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
