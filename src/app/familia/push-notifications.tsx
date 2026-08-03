"use client";

import { useEffect, useState } from "react";

type PushState =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "blocked"
  | "inactive"
  | "active"
  | "working"
  | "error";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export default function PushNotifications() {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("Verificando este aparelho...");

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        setMessage("Este navegador ainda não oferece notificações do aplicativo.");
        return;
      }

      if (isIos() && !isStandalone()) {
        setState("needs-install");
        setMessage("No iPhone, adicione o site à Tela de Início para ativar.");
        return;
      }

      if (Notification.permission === "denied") {
        setState("blocked");
        setMessage("As notificações estão bloqueadas nas configurações do aparelho.");
        return;
      }

      try {
        const currentRegistration = await registration();
        const subscription = await currentRegistration.pushManager.getSubscription();
        setState(subscription ? "active" : "inactive");
        setMessage(
          subscription
            ? "Lembretes ativados neste aparelho."
            : "Receba um aviso duas horas antes de cada culto.",
        );
      } catch {
        setState("error");
        setMessage("Não foi possível verificar as notificações neste aparelho.");
      }
    }

    void check();
  }, []);

  async function enable() {
    setState("working");
    setMessage("Ativando notificações...");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        setMessage(
          permission === "denied"
            ? "A permissão foi bloqueada nas configurações do aparelho."
            : "A permissão não foi concedida.",
        );
        return;
      }

      const keyResponse = await fetch("/api/familia/notificacoes", {
        cache: "no-store",
      });
      const keyData = (await keyResponse.json()) as {
        publicKey?: string;
        error?: string;
      };
      if (!keyResponse.ok || !keyData.publicKey) {
        throw new Error(keyData.error || "Chave indisponível.");
      }

      const currentRegistration = await registration();
      const subscription =
        (await currentRegistration.pushManager.getSubscription()) ||
        (await currentRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        }));
      const serialized = subscription.toJSON();
      const response = await fetch("/api/familia/notificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: serialized.endpoint,
          keys: serialized.keys,
          events: ["domingo-casa", "quarta-ensino", "sexta-oracao"],
        }),
      });

      if (!response.ok) {
        await subscription.unsubscribe();
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Não foi possível salvar a inscrição.");
      }

      setState("active");
      setMessage("Lembretes ativados neste aparelho.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar as notificações.",
      );
    }
  }

  async function disable() {
    setState("working");
    setMessage("Desativando notificações...");

    try {
      const currentRegistration = await registration();
      const subscription = await currentRegistration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/familia/notificacoes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error("Não foi possível desativar agora.");
        await subscription.unsubscribe();
      }
      setState("inactive");
      setMessage("Notificações desativadas neste aparelho.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível desativar as notificações.",
      );
    }
  }

  return (
    <section className="family-push-card" data-state={state}>
      <div>
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Lembretes de cultos
        </p>
        <h2>Não perca o horário da Casa</h2>
        <p>{message}</p>
        <small>Domingo, quarta e sexta. Você pode desativar quando quiser.</small>
      </div>
      {state === "inactive" || state === "error" ? (
        <button type="button" onClick={enable}>
          Ativar lembretes
        </button>
      ) : null}
      {state === "active" ? (
        <button type="button" className="is-secondary" onClick={disable}>
          Desativar
        </button>
      ) : null}
      {state === "working" || state === "checking" ? (
        <button type="button" disabled>
          Aguarde...
        </button>
      ) : null}
    </section>
  );
}
