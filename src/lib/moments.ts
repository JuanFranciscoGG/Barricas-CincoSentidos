import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * A "moment" is never authored separately from operational data (§ discovery
 * doc — automatic moments). It's either a featured Operation (optionally with
 * its own attached photo) or a standalone customer-visible MediaItem. This is
 * the single place the public barrel page's "latest" highlight and full
 * moments gallery both read from.
 */
export interface Moment {
  id: string;
  date: Date;
  title: string;
  note?: string | null;
  photoUrl?: string | null;
  mediaType?: "photo" | "video" | "audio" | null;
}

export async function getMomentsFeed(projectId: string): Promise<Moment[]> {
  const [media, featuredOps] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { projectId, customerVisible: true },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.operation.findMany({
      where: { projectId, featured: true, customerVisible: true },
      include: { operationType: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const featuredOpIds = new Set(featuredOps.map((o) => o.id));
  const moments: Moment[] = [];

  for (const op of featuredOps) {
    const attachedMedia = media.find((m) => m.operationId === op.id);
    moments.push({
      id: `op-${op.id}`,
      date: op.date,
      title: op.customerHeadline || op.operationType.name,
      note: op.customerNote || null,
      photoUrl: attachedMedia?.url ?? null,
      mediaType: (attachedMedia?.type as Moment["mediaType"]) ?? null,
    });
  }

  for (const m of media) {
    if (m.operationId && featuredOpIds.has(m.operationId)) continue; // already represented above
    moments.push({
      id: `media-${m.id}`,
      date: m.capturedAt,
      title: m.caption || "Un momento de tu vino",
      note: null,
      photoUrl: m.url,
      mediaType: m.type as Moment["mediaType"],
    });
  }

  moments.sort((a, b) => b.date.getTime() - a.date.getTime());
  return moments;
}

export async function getLatestMoment(projectId: string): Promise<Moment | null> {
  const feed = await getMomentsFeed(projectId);
  return feed[0] ?? null;
}
