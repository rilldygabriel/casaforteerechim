"use client";

import { useState } from "react";

type PixCopyButtonProps = {
  pixKey: string;
  label: string;
  className?: string;
};

export default function PixCopyButton({
  pixKey,
  label,
  className,
}: PixCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(pixKey);
    } catch {
      const input = document.createElement("textarea");
      input.value = pixKey;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={copyPix}
      className={`${className ?? ""}${copied ? " is-copied" : ""}`.trim()}
    >
      {copied ? "Chave copiada!" : label}
    </button>
  );
}
