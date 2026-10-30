"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { createNote, deleteNote, NoteError, updateNote } from "@/lib/barrel-notes";

/** Winery staff manage the "Lo último" notes; validation is repeated on the server. */
export interface NoteState {
  ok?: boolean;
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
}

function fail(e: unknown): NoteState {
  if (e instanceof NoteError) return { error: e.message, fieldErrors: e.fieldErrors };
  console.error("note action failed", e instanceof Error ? e.message : "unknown error");
  return { error: "No se pudo completar la acción. Probá de nuevo." };
}

function refresh(projectId: string, publicToken: string) {
  revalidatePath("/dashboard/barrels", "layout");
  revalidatePath(`/wine/${publicToken}`);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function createNoteAction(projectId: string, _prev: NoteState, fd: FormData): Promise<NoteState> {
  const session = await requireStaffSession();
  try {
    const barrelId = str(fd, "barrelId");
    // The barrel must belong to the project the admin is working in.
    const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
    if (!barrel || barrel.projectId !== projectId) return { error: "Elegí la barrica de este proyecto.", fieldErrors: { barrelId: "Elegí una barrica." } };
    const { publicToken } = await createNote(barrelId, { title: str(fd, "title"), body: str(fd, "body"), publishedAt: str(fd, "publishedAt") }, session.userId);
    refresh(projectId, publicToken);
    return { ok: true, notice: "Nota publicada." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateNoteAction(projectId: string, noteId: string, _prev: NoteState, fd: FormData): Promise<NoteState> {
  await requireStaffSession();
  try {
    const note = await prisma.barrelNote.findUnique({ where: { id: noteId }, include: { barrel: true } });
    if (!note || note.barrel.projectId !== projectId) return { error: "Nota no encontrada." };
    const { publicToken } = await updateNote(noteId, { title: str(fd, "title"), body: str(fd, "body"), publishedAt: str(fd, "publishedAt") });
    refresh(projectId, publicToken);
    return { ok: true, notice: "Nota guardada." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteNoteAction(projectId: string, noteId: string, _prev: NoteState, _fd: FormData): Promise<NoteState> {
  void _fd;
  await requireStaffSession();
  try {
    const note = await prisma.barrelNote.findUnique({ where: { id: noteId }, include: { barrel: true } });
    if (!note || note.barrel.projectId !== projectId) return { error: "Nota no encontrada." };
    const { publicToken } = await deleteNote(noteId);
    refresh(projectId, publicToken);
    return { ok: true, notice: "Nota eliminada." };
  } catch (e) {
    return fail(e);
  }
}
