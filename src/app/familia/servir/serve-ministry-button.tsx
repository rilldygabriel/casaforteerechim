"use client";

import { useActionState } from "react";
import { type ServeActionState, requestToServe } from "./actions";

const INITIAL_SERVE_ACTION_STATE: ServeActionState = {
  kind: "idle",
  message: "",
};

export default function ServeMinistryButton({
  ministryKey,
  label,
}: {
  ministryKey: string;
  label: string;
}) {
  const [state, formAction, isPending] = useActionState(
    requestToServe,
    INITIAL_SERVE_ACTION_STATE,
  );

  return (
    <form action={formAction} className="serve-card-form">
      <input type="hidden" name="ministryKey" value={ministryKey} />
      <button type="submit" disabled={isPending || state.kind === "success"}>
        {state.kind === "success"
          ? "Líder avisado"
          : isPending
            ? "Enviando…"
            : `Quero participar do ${label}, falar com líder`}
      </button>
      {state.message ? (
        <p className="serve-status" data-kind={state.kind}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
