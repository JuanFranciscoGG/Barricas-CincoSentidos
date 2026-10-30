"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { EditError, updateOperation, updateProject, updateStage } from "@/lib/project-edit";

/**
 * Editing existing projects. Same authorization as the rest of project
 * management (any signed-in staff member — `requireStaffSession`); all input
 * is validated again on the server in src/lib/project-edit.ts.
 */
export interface EditState {
  ok?: boolean;
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
}

function fail(e: unknown): EditState {
  if (e instanceof EditError) return { error: e.message, fieldErrors: e.fieldErrors };
  console.error("project edit failed", e instanceof Error ? e.message : "unknown error");
  return { error: "No se pudieron guardar los cambios. Probá de nuevo." };
}

async function refresh(projectId: string) {
  const project = await prisma.wineProject.findUnique({ where: { id: projectId }, select: { publicToken: true } });
  revalidatePath("/dashboard/barrels", "layout");
  if (project) revalidatePath(`/wine/${project.publicToken}`);
}

function plain(fd: FormData) {
  const out: Record<string, FormDataEntryValue | boolean> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export async function updateProjectAction(projectId: string, _prev: EditState, fd: FormData): Promise<EditState> {
  await requireStaffSession();
  try {
    await updateProject(projectId, plain(fd));
    await refresh(projectId);
    return { ok: true, notice: "Cambios guardados." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStageAction(projectId: string, stageId: string, _prev: EditState, fd: FormData): Promise<EditState> {
  await requireStaffSession();
  try {
    await updateStage(projectId, stageId, plain(fd));
    await refresh(projectId);
    return { ok: true, notice: "Etapa guardada." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateOperationAction(projectId: string, operationId: string, _prev: EditState, fd: FormData): Promise<EditState> {
  await requireStaffSession();
  try {
    await updateOperation(projectId, operationId, {
      ...plain(fd),
      customerVisible: fd.get("customerVisible") === "on",
      featured: fd.get("featured") === "on",
    });
    await refresh(projectId);
    return { ok: true, notice: "Entrada guardada." };
  } catch (e) {
    return fail(e);
  }
}
