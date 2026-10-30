import { prisma } from "@/lib/prisma";

/**
 * Who may read an uploaded file. Cover photos are the one deliberately public image: the PIN
 * screen shows them before anyone has entered the PIN, under unguessable `cover-<uuid>` names.
 * Everything else (operation photos, bottling photos) is private and only reachable through
 * /uploads/[name], which checks authorization. All bytes live in the private file store.
 */

export const isCoverName = (name: string) => name.startsWith("cover-");

/**
 * Which barrels' PIN sessions may read this private upload. Only media the
 * winery marked customer-visible qualifies; anything unreferenced or staff-only
 * returns an empty list (staff reach it through their own session).
 */
export async function barrelIdsAllowedForUpload(name: string): Promise<string[]> {
  const media = await prisma.mediaItem.findMany({
    where: { url: `/uploads/${name}`, customerVisible: true },
    select: { projectId: true },
  });
  if (media.length === 0) return [];
  const barrels = await prisma.barrel.findMany({
    where: { projectId: { in: media.map((m) => m.projectId) } },
    select: { id: true },
  });
  return barrels.map((b) => b.id);
}
