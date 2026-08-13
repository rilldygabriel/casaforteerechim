"use client";

import { useRef } from "react";
import { replaceMinistryAssignments } from "./actions";

type MemberOption = {
  userId: string;
  name: string;
  email: string;
};

export default function BulkAssignmentDialog({
  ministryKey,
  ministryLabel,
  role,
  members,
  selectedMemberIds,
}: {
  ministryKey: string;
  ministryLabel: string;
  role: "leader" | "member";
  members: MemberOption[];
  selectedMemberIds: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selected = new Set(selectedMemberIds);
  const roleLabel = role === "leader" ? "líderes" : "participantes";

  return (
    <>
      <button
        className="leadership-bulk-open"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Selecionar {roleLabel}
      </button>

      <dialog className="leadership-bulk-dialog" ref={dialogRef}>
        <form action={replaceMinistryAssignments}>
          <input type="hidden" name="ministryKey" value={ministryKey} />
          <input type="hidden" name="role" value={role} />

          <header>
            <div>
              <span>{ministryLabel}</span>
              <h2>Selecionar {roleLabel}</h2>
              <p>Marque quantas pessoas quiser e salve tudo de uma vez.</p>
            </div>
            <button
              className="leadership-dialog-close"
              type="button"
              aria-label="Fechar janela"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>

          <div className="leadership-bulk-options">
            {members.map((member) => (
              <label key={member.userId}>
                <input
                  type="checkbox"
                  name="memberIds"
                  value={member.userId}
                  defaultChecked={selected.has(member.userId)}
                />
                <span>
                  <strong>{member.name || member.email}</strong>
                  <small>{member.email}</small>
                </span>
              </label>
            ))}
          </div>

          <footer>
            <button
              className="leadership-dialog-cancel"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button className="leadership-dialog-save" type="submit">
              Salvar seleção
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
