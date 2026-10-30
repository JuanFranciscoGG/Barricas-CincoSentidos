import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { audit, type Actor } from "@/lib/owners/service";
import { getStore, type FileStore } from "@/lib/storage";

/**
 * Per-barrel cover photo (the full-bleed image the NFC page opens with).
 * Stored at BARREL level in Barrel.photoUrl — a plain URL; the bytes live in
 * the file store (see storage.ts), never in the database. A barrel without
 * one keeps the approved default cover.
 */
export const DEFAULT_COVER = "/brand/cellar-barrel.jpg";
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
const UPLOAD_PREFIX = "/uploads/";

export class CoverError extends Error {}

export function resolveCover(photoUrl: string | null | undefined): string {
  return photoUrl && photoUrl.startsWith(UPLOAD_PREFIX) ? photoUrl : DEFAULT_COVER;
}

/** Type is decided from the file's own bytes, not the name or the browser-reported MIME type. */
export function sniffImage(bytes: Uint8Array): { ext: "jpg" | "png" | "webp" } | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: "png" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp" };
  return null;
}

export function validateCover(bytes: Uint8Array) {
  if (bytes.length === 0) throw new CoverError("Elegí una imagen.");
  if (bytes.length > MAX_COVER_BYTES) throw new CoverError("La imagen es muy pesada: el máximo es 8 MB.");
  const kind = sniffImage(bytes);
  if (!kind) throw new CoverError("Formato no válido. Subí una imagen JPG, PNG o WebP.");
  return kind;
}

async function removeFileIfUnused(url: string | null, store: FileStore) {
  if (!url || !url.startsWith(UPLOAD_PREFIX)) return;
  const stillUsed = await prisma.barrel.count({ where: { photoUrl: url } });
  if (stillUsed > 0) return;
  // A file that is already gone needs no cleanup, so a failed delete is not an error.
  await store.remove(path.basename(url)).catch(() => {});
}

/** Save and attach a cover. The previous image is only replaced after the new file is safely on disk. */
export async function setBarrelCover(barrelId: string, bytes: Uint8Array, actor: Actor, store: FileStore = getStore()) {
  const kind = validateCover(bytes);
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
  if (!barrel) throw new CoverError("Barrica no encontrada.");

  const filename = `cover-${randomUUID()}.${kind.ext}`;
  try {
    await store.put(filename, bytes, `image/${kind.ext === "jpg" ? "jpeg" : kind.ext}`);
  } catch {
    throw new CoverError("No pudimos guardar la imagen. La foto anterior se mantiene.");
  }
  const url = `${UPLOAD_PREFIX}${filename}`;
  try {
    // Scoped to this one barrel id — no other barrel can be touched.
    await prisma.barrel.update({ where: { id: barrelId }, data: { photoUrl: url } });
  } catch {
    await store.remove(filename).catch(() => {});
    throw new CoverError("No pudimos guardar la imagen. La foto anterior se mantiene.");
  }
  await removeFileIfUnused(barrel.photoUrl, store);
  await audit(actor, "barrel.cover_changed", { type: "Barrel", id: barrelId });
  return url;
}

/** Remove the custom cover; the barrel falls back to the default image. */
export async function removeBarrelCover(barrelId: string, actor: Actor, store: FileStore = getStore()) {
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
  if (!barrel) throw new CoverError("Barrica no encontrada.");
  if (!barrel.photoUrl) return;
  await prisma.barrel.update({ where: { id: barrelId }, data: { photoUrl: null } });
  await removeFileIfUnused(barrel.photoUrl, store);
  await audit(actor, "barrel.cover_removed", { type: "Barrel", id: barrelId });
}
