import { prisma } from "@/lib/prisma";

/**
 * Admin URLs are keyed by BARREL id: the unified "Barricas" section replaced the
 * old Proyectos section. The WineProject row is unchanged and still holds the
 * wine data; each admin page resolves it from the barrel.
 */
export const barrelPath = (barrelId: string, sub = "") => `/dashboard/barrels/${barrelId}${sub}`;

/** The barrel an admin lands on for a project (its first barrel), or null for a project without barrels. */
export async function primaryBarrelId(projectId: string): Promise<string | null> {
  const b = await prisma.barrel.findFirst({ where: { projectId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return b?.id ?? null;
}
