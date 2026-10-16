"use client";

import { useEffect, useState } from "react";
import type { MediaAccessMember } from "@/lib/media-access-policy";
import styles from "../../pronto-para-postar/media-library.module.css";
import listStyles from "./access-list.module.css";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export default function AccessList() {
  const [members, setMembers] = useState<MediaAccessMember[] | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/midias/acessos", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os cadastros.");
        setMembers(result.members);
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os cadastros.");
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function changeAccess(member: MediaAccessMember, enabled: boolean) {
    setPending(member.user_id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/midias/acessos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.user_id, enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setMembers((current) => current?.map((item) => item.user_id === member.user_id ? { ...item, media_enabled: result.enabled } : item) ?? null);
      setMessage(`${member.full_name || "Cadastro"}: ${enabled ? "Mídias liberado" : "acesso de Mídias retirado"}.${enabled && member.approval_status !== "approved" ? " O acesso ficará disponível após a aprovação do cadastro." : ""}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
    } finally { setPending(null); }
  }

  const visible = members?.filter((member) => normalize(member.full_name || "Cadastro sem nome").includes(normalize(search))) ?? [];
  return <section aria-label="Pessoas cadastradas">
    <label className={styles.search}>Buscar pelo nome<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite um nome…" /></label>
    {message && <p className={styles.notice} role="status">{message}</p>}
    {error && <div role="alert" className={styles.notice}><p>{error}</p><button className={styles.secondary} disabled={Boolean(pending)} onClick={() => setReload((value) => value + 1)}>Recarregar lista</button></div>}
    {!members && !error && <p role="status">Carregando cadastros…</p>}
    {members && <><p className={styles.count}>{members.length} cadastros · {members.filter((member) => member.media_enabled && !member.is_admin).length} pessoas selecionadas para Mídias</p>
      <ul className={listStyles.list}>{visible.map((member) => <li key={member.user_id}>
        <label className={listStyles.person}>
          <input type="checkbox" checked={member.media_enabled || member.is_admin} disabled={member.is_admin || Boolean(pending)} onChange={(event) => void changeAccess(member, event.target.checked)} aria-label={`Liberar Mídias para ${member.full_name || "cadastro sem nome"}`} />
          <span><strong>{member.full_name || "Cadastro sem nome"}</strong><small>{pending === member.user_id ? "Salvando…" : member.is_admin ? "Administrador · acesso já incluído" : member.approval_status !== "approved" ? "Cadastro ainda não aprovado" : member.media_enabled ? "Acesso liberado" : "Sem acesso a Mídias"}</small></span>
        </label>
      </li>)}</ul>
      {visible.length === 0 && <p className={styles.empty}>Nenhum cadastro encontrado para essa busca.</p>}
    </>}
  </section>;
}
