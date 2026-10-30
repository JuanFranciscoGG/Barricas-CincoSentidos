/**
 * `new Date("2026-09-12")` parses as UTC midnight, which then renders as the
 * previous day in any timezone behind UTC — a real off-by-one bug for every
 * date coming from an `<input type="date">`. Parse it as a local calendar
 * date instead.
 */
export function parseLocalDate(yyyyMmDd: string): Date {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayLocalMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** yyyy-mm-dd of a local calendar date, for `<input type="date">` default values. */
export function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
