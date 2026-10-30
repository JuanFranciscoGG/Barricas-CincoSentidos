import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveCard, resolveOriginAndVarietyCards, resolveOriginPlace, composeWineLayers, agingBandKeyFor } from "@/lib/knowledge";
import { getMomentsFeed } from "@/lib/moments";
import { getLatestNote, pickLatest } from "@/lib/barrel-notes";
import { WineHero } from "@/components/wine/WineHero";
import { NowPanel, LatestBand } from "@/components/wine/NowPanel";
import { StorySection } from "@/components/wine/StorySection";
import { EvolutionTimeline, type EvolutionEntry } from "@/components/wine/EvolutionTimeline";
import { BarrelSection, type BarrelFact } from "@/components/wine/BarrelSection";
import { DiscoverSection } from "@/components/wine/DiscoverSection";
import { ExplainedRings } from "@/components/wine/ExplainedRings";
import { IntroCurtain } from "@/components/wine/IntroCurtain";
import { OwnerArea } from "@/components/wine/OwnerArea";
import { BarrelTodayButton } from "@/components/wine/BarrelTodayButton";
import { PinGate } from "@/components/wine/PinGate";
import { SessionGuard } from "@/components/wine/SessionGuard";
import { getBarrelAccess } from "@/lib/owner-session";
import { WineFooter } from "@/components/wine/WineFooter";
import { ChapterMenu, type Chapter } from "@/components/wine/ChapterMenu";
import { resolveCover } from "@/lib/barrel-cover";
import { LightboxProvider } from "@/components/wine/Lightbox";
import { TOAST_LEVEL_LABELS, type ToastLevel } from "@/lib/enums";

export const metadata = { robots: { index: false, follow: false } };

/**
 * The NFC/QR destination — what actually opens when someone taps the duela.
 * The URL token only says WHICH barrel; it proves nothing. Until the barrel's
 * six-digit PIN has been verified (a valid private session for this barrel,
 * re-checked against the database), the server renders only the PIN screen
 * and nothing about the barrel is queried or sent. Once unlocked it still only
 * surfaces what the winery marked customer-safe — never lab data or internal
 * notes. Reading cookies makes this route dynamic, so it is never statically
 * cached or shared between visitors.
 */
export default async function PublicWinePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const project = await prisma.wineProject.findUnique({
    where: { publicToken: token },
    include: { barrels: true, story: true, customer: true },
  });
  if (!project) notFound();

  const barrel = project.barrels[0];
  if (!barrel || !(await getBarrelAccess(barrel.id))) {
    return <PinGate token={token} cover={resolveCover(barrel?.photoUrl)} configured={Boolean(barrel?.pinHash) && !barrel?.accessRevoked} />;
  }
  const daysAging = project.startDate
    ? Math.floor((new Date().getTime() - project.startDate.getTime()) / 86_400_000)
    : null;
  const monthsAging = daysAging !== null ? Math.floor(daysAging / 30) : 0;
  const estimatedDays = project.estimatedAgingMonths ? project.estimatedAgingMonths * 30 : null;
  const progress = estimatedDays && daysAging ? Math.min(100, Math.round((daysAging / estimatedDays) * 100)) : null;

  const [
    operations,
    moments,
    bottling,
    originPlace,
    varietyCards,
    barrelCard,
    toastCard,
    comparisonCard,
    agingCard,
    wineLayers,
    latestNote,
  ] = await Promise.all([
    prisma.operation.findMany({
      where: { projectId: project.id, customerVisible: true },
      include: { operationType: true },
      orderBy: { date: "asc" },
    }),
    getMomentsFeed(project.id),
    prisma.bottlingRecord.findFirst({ where: { projectId: project.id }, orderBy: { bottlingDate: "desc" } }),
    resolveOriginPlace(project.originKnowledgeKey, project.varietyKnowledgeKey),
    resolveOriginAndVarietyCards(project.varietyKnowledgeKey, "QUÉ ES ESTE VINO"),
    resolveCard(barrel?.oakOriginKnowledgeKey, "SU BARRICA"),
    resolveCard(barrel?.toastLevelKnowledgeKey, "EL TUESTE DE LA BARRICA"),
    resolveCard("french-vs-american-oak", "ROBLE FRANCÉS VS. AMERICANO"),
    resolveCard(agingBandKeyFor(monthsAging), "QUÉ PASA AHORA"),
    composeWineLayers({
      varietyKey: project.varietyKnowledgeKey,
      originKey: project.originKnowledgeKey,
      oakOriginKey: barrel?.oakOriginKnowledgeKey,
      toastLevelKey: barrel?.toastLevelKnowledgeKey,
      agingBandKey: agingBandKeyFor(monthsAging),
    }),
    barrel ? getLatestNote(barrel.id) : Promise.resolve(null),
  ]);

  // Per-barrel cover photo; barrels without one keep the approved default.
  const coverImage = resolveCover(barrel?.photoUrl);

  const latestMoment = moments[0] ?? null;
  // Standalone media only — featured operations are already represented in
  // `operations` below, so folding the same moments feed in here again would
  // show each featured operation twice in one timeline.
  const standaloneMoments = moments.filter((m) => m.id.startsWith("media-"));

  const hasStory = Boolean(project.story?.visible && project.story.text);
  const hasAhora = daysAging !== null || Boolean(latestMoment) || Boolean(latestNote);
  const hasEvolucion = operations.length > 0 || standaloneMoments.length > 0 || Boolean(bottling) || Boolean(estimatedDays);
  const hasBarrica = Boolean(barrel);
  const hasDescubri = Boolean(originPlace) || varietyCards.length > 0 || wineLayers.length > 0 || Boolean(agingCard);

  // --- Evolution timeline: merge operations + standalone moments + bottling
  // (real or estimated) into one chronological log. ---
  const evolutionEntries: EvolutionEntry[] = [];
  for (const op of operations) {
    evolutionEntries.push({
      id: `op-${op.id}`,
      date: op.date,
      title: op.customerHeadline || op.operationType.name,
      note: op.customerNote || op.notes || null,
      completed: op.completed,
    });
  }
  for (const m of standaloneMoments) {
    evolutionEntries.push({ id: m.id, date: m.date, title: m.title, note: m.note ?? null, completed: true });
  }
  if (bottling) {
    evolutionEntries.push({
      id: "bottling",
      date: bottling.bottlingDate,
      title: "Embotellado",
      completed: true,
      isBottling: true,
      bottleCount: bottling.bottleCount,
      litersObtained: bottling.litersObtained,
    });
  } else if (project.startDate && estimatedDays) {
    const estimated = new Date(project.startDate.getTime() + estimatedDays * 86_400_000);
    evolutionEntries.push({
      id: "bottling-estimate",
      date: estimated,
      title: "Embotellado",
      completed: false,
      isBottling: true,
      bottleCount: null,
      litersObtained: null,
    });
  }
  evolutionEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastCompletedIndex = evolutionEntries.reduce(
    (acc, e, i) => (e.completed ? i : acc),
    -1
  );
  if (lastCompletedIndex >= 0) evolutionEntries[lastCompletedIndex].isNow = true;

  // "What's coming" on the Ahora panel — the earliest unfinished operation.
  const nextOp = operations.find((op) => !op.completed) ?? null;
  const now = new Date().getTime();

  // --- Barrel facts (tap-to-reveal), mapped from real data only. ---
  const facts: BarrelFact[] = barrel
    ? [
        { key: "type", label: "TIPO", value: barrel.type ?? "—", card: null },
        { key: "brand", label: "TONELERÍA", value: barrel.brand ?? "—", card: barrelCard },
        { key: "alcohol", label: "ALCOHOL", value: project.alcohol ? `${String(project.alcohol).replace(".", ",")}%` : "—", card: null },
        { key: "volume", label: "VOLUMEN", value: barrel.volumeLiters ? `${barrel.volumeLiters} L` : "—", card: null },
        {
          key: "toast",
          label: "TUESTE",
          value: barrel.toastLevel ? TOAST_LEVEL_LABELS[barrel.toastLevel as ToastLevel] : "—",
          card: toastCard,
        },
      ]
    : [];

  const discoverCards = [...varietyCards, ...(agingCard ? [agingCard] : [])];

  const chapters: Chapter[] = [
    hasAhora && { id: "ahora", num: "01", title: "Ahora", meta: daysAging !== null ? `${daysAging} días` : undefined },
    hasBarrica && { id: "barrica", num: "02", title: "Su barrica", meta: barrel!.number },
    hasEvolucion && { id: "evolucion", num: "03", title: "Evolución", meta: `${evolutionEntries.length} hitos` },
    hasDescubri && { id: "descubri", num: "04", title: "Descubrí" },
    hasStory && { id: "historia", num: "05", title: "Su historia" },
    { id: "regalo", num: "06", title: "Regalar" },
  ].filter((c): c is Chapter => Boolean(c));

  return (
    <LightboxProvider>
      <IntroCurtain heroImage={coverImage} variety={project.variety} vintage={project.vintage} barrelNumber={barrel?.number ?? null} />
      <div style={{ background: "var(--cs-paper)" }}>
        {hasAhora && (
          <>
            <WineHero
              heroImage={coverImage}
              variety={project.variety}
              vintage={project.vintage}
              barrelNumber={barrel?.number ?? null}
              customerName={project.customer?.name ?? null}
              statusLabel={bottling ? "Embotellado" : "En crianza"}
            />
            <NowPanel
              startDate={project.startDate}
              daysAging={daysAging ?? 0}
              progress={progress}
              estimatedMonths={project.estimatedAgingMonths ?? null}
              bottled={Boolean(bottling)}
              extra={barrel ? <BarrelTodayButton token={token} barrelNumber={barrel.number} wineName={project.name} /> : null}
              nextOperation={
                nextOp
                  ? {
                      date: nextOp.date,
                      title: nextOp.customerHeadline || nextOp.operationType.name,
                      daysAway: Math.max(0, Math.round((nextOp.date.getTime() - now) / 86_400_000)),
                    }
                  : null
              }
            />
            {(() => {
              // "Lo último": whichever is newer — the latest task/moment (unchanged) or the winery's latest note.
              const latest = pickLatest(latestMoment, latestNote);
              return latest ? <LatestBand moment={latest} /> : null;
            })()}
          </>
        )}

        {hasBarrica && (
          <BarrelSection
            barrelNumber={barrel!.number}
            facts={facts}
            comparisonCard={comparisonCard}
          />
        )}

        {hasEvolucion && <EvolutionTimeline
            entries={evolutionEntries}
            startDate={project.startDate}
            daysAging={daysAging ?? 0}
            estimatedDays={estimatedDays}
            oakLabel={barrelCard?.title ?? null}
          />}

        {hasDescubri && (
          <DiscoverSection originPlace={originPlace} cards={discoverCards} />
        )}

        {wineLayers.length > 0 && (
          <ExplainedRings layers={wineLayers} agingPct={progress} />
        )}

        {hasStory && <StorySection text={project.story!.text} />}

        <OwnerArea
          token={token}
          wine={{
            name: project.name,
            vintage: `${project.variety}${project.vintage ? ` ${project.vintage}` : ""}`,
            origin: originPlace?.title ?? project.origin ?? "",
            barrel: barrel?.number ?? "",
            oak: barrelCard?.title ?? "",
          }}
        />

        <WineFooter>
          <SessionGuard token={token} />
        </WineFooter>
      </div>

      {chapters.length > 0 && <ChapterMenu chapters={chapters} />}
    </LightboxProvider>
  );
}
