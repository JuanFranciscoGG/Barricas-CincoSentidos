"use server";

import { prisma } from "@/lib/prisma";
import { getBarrelAccess } from "@/lib/owner-session";
import { getMomentsFeed } from "@/lib/moments";
import { getLatestNote } from "@/lib/barrel-notes";
import { buildBarrelToday, type BarrelTodayData } from "@/lib/barrel-today";

/**
 * Fresh data for the "Mi barrica hoy" image, read at the moment the visitor
 * asks for it. The barrel is resolved from the URL token (the same barrel the
 * page shows) and the caller must hold a valid PIN session for THAT barrel, so
 * it can never return another barrel's data to an unauthenticated caller.
 */
export async function getBarrelToday(token: string): Promise<{ ok: true; data: BarrelTodayData } | { ok: false; error: string }> {
  try {
    if (typeof token !== "string" || token.length < 8 || token.length > 64) return { ok: false, error: "No encontramos esta barrica." };
    const project = await prisma.wineProject.findUnique({
      where: { publicToken: token },
      include: { barrels: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    const barrel = project?.barrels[0];
    if (!project || !barrel) return { ok: false, error: "No encontramos esta barrica." };
    if (!(await getBarrelAccess(barrel.id))) return { ok: false, error: "Tu sesión venció. Ingresá el PIN de nuevo." };

    const [moments, latestNote] = await Promise.all([getMomentsFeed(project.id), getLatestNote(barrel.id)]);
    // Same inputs as the "Lo último" section: newest moment vs. newest note.
    const m = moments[0] ?? null;
    return {
      ok: true,
      data: buildBarrelToday({
        barrel,
        project,
        latestMoment: m ? { date: m.date, title: m.title, note: m.note ?? null } : null,
        latestNote,
      }),
    };
  } catch (e) {
    console.error("barrel today failed", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: "No pudimos preparar la imagen. Probá de nuevo." };
  }
}
