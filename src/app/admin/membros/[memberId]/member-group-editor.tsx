"use client";

import { useActionState } from "react";
import { saveMemberGroups, type MemberGroupState } from "./actions";

const INITIAL_STATE: MemberGroupState = { kind: "idle", message: "" };

const GROUPS = [
  { key: "voluntario", name: "Voluntário", description: "Serve voluntariamente nas atividades da Casa." },
  { key: "discipulador", name: "Discipulador", description: "Pode acompanhar discípulos e acessar o painel de discipulado." },
  { key: "equipe_pastoral", name: "Equipe Pastoral", description: "Faz parte da equipe de apoio dos pastores." },
  { key: "sendo_discipulado", name: "Sendo Discipulado", description: "Está em caminhada de discipulado na Casa." },
] as const;

export default function MemberGroupEditor({
  memberId,
  selectedGroups,
}: {
  memberId: string;
  selectedGroups: string[];
}) {
  const [state, formAction, pending] = useActionState(saveMemberGroups, INITIAL_STATE);
  const selected = new Set(selectedGroups);

  return (
    <form action={formAction} className="admin-member-groups-form">
      <input type="hidden" name="memberId" value={memberId} />
      <fieldset disabled={pending}>
        <legend className="sr-only">Grupos deste membro</legend>
        <div className="admin-member-groups-grid">
          {GROUPS.map((group) => (
            <label key={group.key} className="admin-member-group-option">
              <input
                type="checkbox"
                name="groupKeys"
                value={group.key}
                defaultChecked={selected.has(group.key)}
              />
              <span className="admin-member-group-check" aria-hidden="true">✓</span>
              <span>
                <strong>{group.name}</strong>
                <small>{group.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="admin-member-groups-footer">
        <p role="status" aria-live="polite" data-kind={state.kind}>{state.message}</p>
        <button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar classificação"}</button>
      </div>
    </form>
  );
}
