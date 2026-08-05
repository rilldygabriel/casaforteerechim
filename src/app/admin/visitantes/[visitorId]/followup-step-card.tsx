"use client";

import { useActionState } from "react";
import {
  claimVisitorFollowupStep,
  completeVisitorFollowupStep,
  type VisitorStepActionState,
} from "./actions";

const INITIAL: VisitorStepActionState = { kind: "idle", message: "" };

type Props = {
  stepNumber: number;
  stepId: number;
  visitorId: number;
  title: string;
  description: string;
  dueLabel: string;
  status: "pending" | "overdue" | "completed";
  assignedName: string | null;
  completedByName: string | null;
  completedLabel: string | null;
  notes: string | null;
  whatsappUrl: string;
};

export default function FollowupStepCard(props: Props) {
  const [claimState, claimAction, claiming] = useActionState(
    claimVisitorFollowupStep,
    INITIAL,
  );
  const [completeState, completeAction, completing] = useActionState(
    completeVisitorFollowupStep,
    INITIAL,
  );

  return (
    <article className="visitor-step-card" data-status={props.status}>
      <header>
        <div>
          <span>Etapa {props.stepNumber} · {" "}
            {props.status === "completed"
              ? "Concluída"
              : props.status === "overdue"
                ? "Atrasada"
                : "Pendente"}
          </span>
          <h2>{props.title}</h2>
        </div>
        <time>{props.dueLabel}</time>
      </header>
      <p>{props.description}</p>

      {props.status === "completed" ? (
        <div className="visitor-step-completed">
          <strong>{props.completedByName || "Equipe Connect"}</strong>
          <span>{props.completedLabel}</span>
          {props.notes ? <p>{props.notes}</p> : null}
        </div>
      ) : (
        <>
          <div className="visitor-step-owner">
            <span>Responsável</span>
            <strong>{props.assignedName || "Ainda não assumida"}</strong>
          </div>

          <div className="visitor-step-links">
            <a href={props.whatsappUrl} target="_blank" rel="noreferrer">
              Abrir WhatsApp do visitante
            </a>
            {!props.assignedName ? (
              <form action={claimAction}>
                <input type="hidden" name="stepId" value={props.stepId} />
                <input type="hidden" name="visitorId" value={props.visitorId} />
                <button type="submit" disabled={claiming}>
                  {claiming ? "Assumindo..." : "Eu assumo esta etapa"}
                </button>
              </form>
            ) : null}
          </div>

          <form className="visitor-step-complete-form" action={completeAction}>
            <input type="hidden" name="stepId" value={props.stepId} />
            <input type="hidden" name="visitorId" value={props.visitorId} />
            <label>
              Observação do contato
              <textarea
                name="notes"
                maxLength={2000}
                rows={3}
                placeholder="Ex.: respondeu bem, pediu oração, confirmou presença..."
              />
            </label>
            <button type="submit" disabled={completing}>
              {completing ? "Salvando..." : "Confirmar mensagem enviada"}
            </button>
          </form>
        </>
      )}

      {claimState.message ? (
        <p className="visitor-step-feedback" data-kind={claimState.kind}>
          {claimState.message}
        </p>
      ) : null}
      {completeState.message ? (
        <p className="visitor-step-feedback" data-kind={completeState.kind}>
          {completeState.message}
        </p>
      ) : null}
    </article>
  );
}
