"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { CoverError, MAX_COVER_BYTES, removeBarrelCover, setBarrelCover } from "@/lib/barrel-cover";

export interface CoverState {
  ok?: boolean;
  error?: string;
  notice?: string;
}

async function refresh(barrelId: string) {
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId }, include: { project: true } });
  revalidatePath(`/dashboard/barrels/${barrelId}`, "layout");
  if (barrel) revalidatePath(`/wine/${barrel.project.publicToken}`);
}

function fail(e: unknown): CoverState {
  if (e instanceof CoverError) return { error: e.message };
  console.error("cover action failed", e instanceof Error ? e.message : "unknown error");
  return { error: "No se pudo completar la acción." };
}

/** Upload or replace a barrel's cover photo (admin only). */
export async function saveBarrelCoverAction(barrelId: string, _prev: CoverState, fd: FormData): Promise<CoverState> {
  const session = await requireAdminSession();
  try {
    const file = fd.get("cover");
    if (!(file instanceof File) || file.size === 0) return { error: "Elegí una imagen." };
    if (file.size > MAX_COVER_BYTES) return { error: "La imagen es muy pesada: el máximo es 8 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    await setBarrelCover(barrelId, bytes, { type: "staff", id: session.userId, name: session.name });
    await refresh(barrelId);
    return { ok: true, notice: "Foto de portada guardada." };
  } catch (e) {
    return fail(e);
  }
}

export async function removeBarrelCoverAction(barrelId: string, _prev: CoverState, _fd: FormData): Promise<CoverState> {
  void _fd;
  const session = await requireAdminSession();
  try {
    await removeBarrelCover(barrelId, { type: "staff", id: session.userId, name: session.name });
    await refresh(barrelId);
    return { ok: true, notice: "Foto quitada: la barrica vuelve a la portada por defecto." };
  } catch (e) {
    return fail(e);
  }
}
