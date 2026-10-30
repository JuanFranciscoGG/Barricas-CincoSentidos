import { pickLatest, type LatestItem } from "@/lib/barrel-notes";
import { resolveCover } from "@/lib/barrel-cover";

/**
 * Data for the shareable "Mi barrica hoy" image. Only information the public
 * barrel page already shows — nothing private (no gifts, recipients,
 * inventory, owners or PINs). Pure function so it can be tested directly;
 * the server action feeds it real records.
 */
export interface BarrelTodayData {
  barrelNumber: string;
  wineName: string;
  variety: string;
  vintage: number | null;
  /** ISO string of the real recorded aging start, or null when none is recorded. */
  startDate: string | null;
  /** Newest of: latest task/moment (as in "Lo último") or the winery's latest note. */
  latest: { kind: "task" | "note"; title: string; note: string | null; date: string } | null;
  coverImage: string;
}

export { agingDays, DAY_MS } from "@/lib/aging";

export function buildBarrelToday(input: {
  barrel: { number: string; photoUrl: string | null };
  project: { name: string; variety: string; vintage: number | null; startDate: Date | null };
  latestMoment: LatestItem | null;
  latestNote: LatestItem | null;
}): BarrelTodayData {
  const picked = pickLatest(input.latestMoment, input.latestNote);
  const kind: "task" | "note" | null = !picked ? null : picked === input.latestNote ? "note" : "task";
  return {
    barrelNumber: input.barrel.number,
    wineName: input.project.name,
    variety: input.project.variety,
    vintage: input.project.vintage,
    startDate: input.project.startDate ? input.project.startDate.toISOString() : null,
    latest: picked && kind ? { kind, title: picked.title, note: picked.note ?? null, date: picked.date.toISOString() } : null,
    coverImage: resolveCover(input.barrel.photoUrl),
  };
}
