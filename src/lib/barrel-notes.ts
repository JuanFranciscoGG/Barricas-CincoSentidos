import { prisma } from "@/lib/prisma";

/**
 * Winery notes for a barrel's "Lo último" section. Stored in their own table:
 * a note never creates a task (Operation), never touches task history and
 * never adds a stage. Framework-free so it can be tested directly.
 */

export class NoteError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

export interface LatestItem {
  date: Date;
  title: string;
  note?: string | null;
}

function clean(input: { title: string; body?: string | null; publishedAt?: string | null }) {
  const title = (input.title ?? "").trim().replace(/\s+/g, " ");
  const body = (input.body ?? "").trim();
  const errors: Record<string, string> = {};
  if (!title) errors.title = "El título es obligatorio.";
  else if (title.length > 120) errors.title = "Título: máximo 120 caracteres.";
  if (body.length > 1000) errors.body = "Descripción: máximo 1000 caracteres.";
  let publishedAt: Date | undefined;
  const raw = (input.publishedAt ?? "").trim();
  if (raw) {
    // "YYYY-MM-DDTHH:mm" from a datetime-local input: interpreted as local time.
    const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? new Date(raw) : new Date(NaN);
    if (Number.isNaN(d.getTime())) errors.publishedAt = "Fecha de publicación inválida.";
    else publishedAt = d;
  }
  if (Object.keys(errors).length) throw new NoteError(Object.values(errors)[0], errors);
  return { title, body: body || null, publishedAt };
}

export async function createNote(barrelId: string, input: { title: string; body?: string | null; publishedAt?: string | null }, createdById?: string | null) {
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId }, include: { project: true } });
  if (!barrel) throw new NoteError("Barrica no encontrada.");
  const data = clean(input);
  const note = await prisma.barrelNote.create({
    data: { barrelId, title: data.title, body: data.body, publishedAt: data.publishedAt ?? new Date(), createdById: createdById ?? null },
  });
  return { note, publicToken: barrel.project.publicToken };
}

export async function updateNote(noteId: string, input: { title: string; body?: string | null; publishedAt?: string | null }) {
  const existing = await prisma.barrelNote.findUnique({ where: { id: noteId }, include: { barrel: { include: { project: true } } } });
  if (!existing) throw new NoteError("Nota no encontrada.");
  const data = clean(input);
  await prisma.barrelNote.update({
    where: { id: noteId },
    // barrelId is never changed on edit: a note always stays with the barrel it was written for.
    data: { title: data.title, body: data.body, ...(data.publishedAt ? { publishedAt: data.publishedAt } : {}) },
  });
  return { publicToken: existing.barrel.project.publicToken };
}

export async function deleteNote(noteId: string) {
  const existing = await prisma.barrelNote.findUnique({ where: { id: noteId }, include: { barrel: { include: { project: true } } } });
  if (!existing) throw new NoteError("Nota no encontrada.");
  await prisma.barrelNote.delete({ where: { id: noteId } });
  return { publicToken: existing.barrel.project.publicToken };
}

/** Newest note of THIS barrel only. */
export async function getLatestNote(barrelId: string): Promise<LatestItem | null> {
  const n = await prisma.barrelNote.findFirst({ where: { barrelId }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }] });
  return n ? { date: n.publishedAt, title: n.title, note: n.body } : null;
}

/**
 * "Lo último" shows whichever is more recent: the latest task/moment (shown
 * exactly as before) or the latest winery note. A moment's date is a calendar
 * day (midnight); a note carries a full timestamp, so a note published on the
 * same day as a task counts as newer. Without notes, the task is returned
 * unchanged.
 */
export function pickLatest<M extends LatestItem>(moment: M | null, note: LatestItem | null): M | LatestItem | null {
  if (!note) return moment;
  if (!moment) return note;
  return note.date.getTime() >= moment.date.getTime() ? note : moment;
}
