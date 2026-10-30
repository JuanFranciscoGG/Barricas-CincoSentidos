// Pure helpers (safe for both server and browser bundles).
export const DAY_MS = 86_400_000;

/** Same formula the portal uses for "días en crianza". Null when no start date was recorded. */
export function agingDays(startDate: Date | string | null, now: Date = new Date()): number | null {
  if (!startDate) return null;
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY_MS));
}
