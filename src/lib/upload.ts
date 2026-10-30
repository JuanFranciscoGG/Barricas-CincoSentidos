import "server-only";
import { randomUUID } from "crypto";
import { getStore } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Saves an uploaded file to the private file store (see storage.ts) and returns its /uploads/...
 * URL. That route only serves it to authorized viewers (see upload-access.ts).
 */
export async function saveUploadedFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filename = `${randomUUID()}.${rawExt}`;
  await getStore().put(filename, bytes, CONTENT_TYPES[rawExt] ?? "application/octet-stream");
  return `/uploads/${filename}`;
}
