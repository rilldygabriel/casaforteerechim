"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type MemberListRecord = {
  user_id: string;
  full_name: string;
  created_at: string;
};

type MembersListProps = {
  members: MemberListRecord[];
  hasLoadError: boolean;
};

type SortOrder = "alphabetical" | "recent";

export default function MembersList({
  members,
  hasLoadError,
}: MembersListProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("alphabetical");

  const sortedMembers = useMemo(() => {
    return [...members].sort((first, second) => {
      if (sortOrder === "recent") {
        return (
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime()
        );
      }

      return (first.full_name || "Nome não informado").localeCompare(
        second.full_name || "Nome não informado",
        "pt-BR",
        { sensitivity: "base" },
      );
    });
  }, [members, sortOrder]);

  if (hasLoadError) {
    return (
      <section className="admin-visitors-state admin-visitors-error" role="alert">
        <span aria-hidden="true">!</span>
        <h2>Não foi possível carregar os membros.</h2>
        <p>Nenhum dado foi alterado. Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  return (
    <section
      className="admin-member-directory"
      aria-labelledby="member-directory-title"
    >
      <header className="admin-member-directory-header">
        <div>
          <h2 id="member-directory-title">Lista de membros</h2>
          <p>
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </p>
        </div>

        <label>
          <span>Ordenar por</span>
          <select
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as SortOrder)
            }
          >
            <option value="alphabetical">Ordem alfabética (A–Z)</option>
            <option value="recent">Últimos inscritos</option>
          </select>
        </label>
      </header>

      {sortedMembers.length === 0 ? (
        <div className="admin-visitors-state">
          <span aria-hidden="true">0</span>
          <h2>Nenhum membro cadastrado.</h2>
          <p>Os novos membros aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <ol className="admin-member-directory-list">
          {sortedMembers.map((member, index) => (
            <li key={member.user_id}>
              <Link href={`/admin/membros/${member.user_id}`}>
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{member.full_name || "Nome não informado"}</strong>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
