"use client";

import { useFormStatus } from "react-dom";

export function DiscipleshipSubmitButton({
  children,
  pendingLabel = "Salvando…",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending}>{pending ? pendingLabel : children}</button>;
}
