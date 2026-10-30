export function ownerStatusBadge(status: string): { label: string; tone: "neutral" | "brass" | "high" | "med" | "low" } {
  if (status === "disabled") return { label: "Deshabilitado", tone: "high" };
  return { label: "Activo", tone: "low" };
}

export function barrelPinBadge(barrel: { pinHash: string | null; accessRevoked: boolean }): { label: string; tone: "neutral" | "brass" | "high" | "med" | "low" } {
  if (barrel.accessRevoked) return { label: "Acceso revocado", tone: "high" };
  if (!barrel.pinHash) return { label: "PIN pendiente", tone: "med" };
  return { label: "PIN configurado", tone: "low" };
}
