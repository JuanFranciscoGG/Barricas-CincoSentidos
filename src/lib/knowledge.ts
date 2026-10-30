import "server-only";
import { prisma } from "@/lib/prisma";

export interface FactChip {
  label: string;
  value: string;
}

export interface DiscoverCard {
  eyebrow: string;
  title: string;
  locationLine?: string | null;
  teaser?: string | null;
  factChips: FactChip[];
  narrative: string;
}

export interface OriginPlace {
  title: string;
  locationLine: string | null;
  elevationMeters: number | null;
  teaser: string | null;
  narrative: string;
  factChips: FactChip[];
}

function parseChips(raw: string): FactChip[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Variety-only now — origin has its own dedicated visualization
 * (see `resolveOriginPlace`) so it no longer doubles up in the generic
 * accordion. Never a generic filler paragraph — an unresolved key simply
 * produces no card.
 */
export async function resolveOriginAndVarietyCards(
  varietyKey: string | null | undefined,
  eyebrow: string
): Promise<DiscoverCard[]> {
  const variety = varietyKey
    ? await prisma.knowledgeEntry.findUnique({ where: { key: varietyKey } })
    : null;
  if (!variety || variety.status !== "published") return [];
  return [
    {
      eyebrow,
      title: variety.title,
      locationLine: variety.locationLine,
      teaser: variety.teaser,
      factChips: parseChips(variety.factChips),
      narrative: variety.narrative,
    },
  ];
}

/**
 * Resolves the "wine and its origin" place — the region entry backing
 * `originKey`, with its narrative swapped for a curated origin+variety
 * `KnowledgePairing` when one is published (same resolution chain as
 * before, just scoped to origin only; the pairing's richer narrative
 * still surfaces, it just lives on the origin block now instead of a
 * separate accordion card).
 */
export async function resolveOriginPlace(
  originKey: string | null | undefined,
  varietyKey: string | null | undefined
): Promise<OriginPlace | null> {
  const region = originKey
    ? await prisma.knowledgeEntry.findUnique({ where: { key: originKey } })
    : null;
  if (!region || region.status !== "published") return null;

  let narrative = region.narrative;
  if (varietyKey) {
    const variety = await prisma.knowledgeEntry.findUnique({ where: { key: varietyKey } });
    if (variety) {
      const pairing = await prisma.knowledgePairing.findFirst({
        where: {
          status: "published",
          OR: [
            { entryAId: variety.id, entryBId: region.id },
            { entryAId: region.id, entryBId: variety.id },
          ],
        },
      });
      if (pairing?.narrative) narrative = pairing.narrative;
    }
  }

  return {
    title: region.title,
    locationLine: region.locationLine,
    elevationMeters: region.elevationMeters,
    teaser: region.teaser,
    narrative,
    factChips: parseChips(region.factChips),
  };
}

export async function resolveCard(
  key: string | null | undefined,
  eyebrow: string
): Promise<DiscoverCard | null> {
  if (!key) return null;
  const entry = await prisma.knowledgeEntry.findUnique({ where: { key } });
  if (!entry || entry.status !== "published") return null;
  return {
    eyebrow,
    title: entry.title,
    locationLine: entry.locationLine,
    teaser: entry.teaser,
    factChips: parseChips(entry.factChips),
    narrative: entry.narrative,
  };
}

/** Only maps to bands that actually have a curated entry — see prisma/seed.ts. */
export function agingBandKeyFor(monthsAging: number): string | null {
  if (monthsAging < 0) return null;
  if (monthsAging < 9) return "band-0-9-months";
  if (monthsAging <= 15) return "band-9-15-months";
  return "band-15-plus-months";
}

export interface WineLayer {
  axis: string;
  value: string;
  text: string;
}

const LAYER_AXES = ["LA UVA", "EL ORIGEN", "EL ROBLE", "EL TUESTE", "LA CRIANZA"];

/**
 * The same published teasers composeWineNarrative joins, kept separate per
 * axis (grape, origin, oak, toast, aging) so the UI can present them as
 * layers. Never invents a claim that isn't already in a published entry.
 */
export async function composeWineLayers(keys: {
  varietyKey?: string | null;
  originKey?: string | null;
  oakOriginKey?: string | null;
  toastLevelKey?: string | null;
  agingBandKey?: string | null;
}): Promise<WineLayer[]> {
  const orderedKeys = [keys.varietyKey, keys.originKey, keys.oakOriginKey, keys.toastLevelKey, keys.agingBandKey];
  const entries = await Promise.all(
    orderedKeys.map((key) => (key ? prisma.knowledgeEntry.findUnique({ where: { key } }) : Promise.resolve(null)))
  );
  const layers: WineLayer[] = [];
  entries.forEach((e, i) => {
    if (e && e.status === "published" && e.teaser) layers.push({ axis: LAYER_AXES[i], value: e.title, text: e.teaser });
  });
  // Fewer than two facts isn't a synthesis, it's just one card repeated.
  return layers.length < 2 ? [] : layers;
}

export async function composeWineNarrative(keys: Parameters<typeof composeWineLayers>[0]): Promise<string | null> {
  const layers = await composeWineLayers(keys);
  return layers.length ? layers.map((l) => l.text).join(" ") : null;
}
