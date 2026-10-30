"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyButton({
  text,
  label = "Copiar URL",
  copiedLabel = "¡Copiada!",
  variant = "secondary",
  size = "sm",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — nothing to do.
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={handleCopy}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
