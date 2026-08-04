"use client";

import { useActionState } from "react";
import {
  reviewRoleRequest,
  type RoleRequestActionState,
} from "./actions";

const INITIAL_STATE: RoleRequestActionState = { kind: "idle", message: "" };

export default function RoleRequestActions({
  type,
  memberId,
  referenceId,
}: {
  type: "ministry" | "discipleship";
  memberId: string;
  referenceId: string;
}) {
  const [state, formAction, pending] = useActionState(
    reviewRoleRequest,
    INITIAL_STATE,
  );

  return (
    <div className="admin-role-request-actions">
      <form action={formAction}>
        <input type="hidden" name="requestType" value={type} />
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="referenceId" value={referenceId} />
        <button name="decision" value="approve" disabled={pending}>
          {pending ? "Salvando…" : "Aceitar"}
        </button>
        <button name="decision" value="reject" disabled={pending}>
          Recusar
        </button>
      </form>
      {state.message ? (
        <p role="status" aria-live="polite" data-kind={state.kind}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
