"use client";

export default function SiteAssistantTrigger() {
  function openAssistant() {
    window.dispatchEvent(new Event("casa-forte:open-assistant"));
  }

  return (
    <button
      className="home-assistant-trigger"
      type="button"
      onClick={openAssistant}
      aria-label="Conversar com a IA da Casa"
      title="IA da Casa"
    >
      <span aria-hidden="true">✦</span>
      <strong>IA</strong>
    </button>
  );
}
