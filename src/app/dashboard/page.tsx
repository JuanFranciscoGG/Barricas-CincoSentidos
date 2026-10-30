import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { BarrelSearch, type BarrelOption } from "@/components/BarrelSearch";
import { Badge } from "@/components/ui/Badge";
import { requireStaffSession } from "@/lib/auth-guard";
import { BARREL_STATUS_LABELS, type BarrelStatus } from "@/lib/enums";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireStaffSession();
  const { q } = await searchParams;
  const query = q?.trim();

  const [matches, allBarrels, tasks, recent, myRecentOps] = await Promise.all([
    query
      ? prisma.barrel.findMany({
          where: { number: { contains: query, mode: "insensitive" } },
          include: { project: { include: { customer: true } } },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.barrel.findMany({
      include: { project: { include: { customer: true } } },
      orderBy: { number: "asc" },
    }),
    prisma.operation.findMany({
      where: { completed: false, date: { gte: new Date() } },
      include: { operationType: true, project: true, barrel: true },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.operation.findMany({
      where: { completed: true },
      include: { operationType: true, project: true, barrel: true },
      orderBy: { date: "desc" },
      take: 6,
    }),
    prisma.operation.findMany({
      where: { createdById: session.userId, barrelId: { not: null } },
      include: { barrel: true, project: { include: { customer: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  // Zero-typing return path: the barrels this person actually touched most
  // recently, deduped, so re-opening a barrel they're mid-round-with doesn't
  // require typing its number again.
  const seenBarrels = new Set<string>();
  const recentBarrels = [];
  for (const op of myRecentOps) {
    if (!op.barrel || seenBarrels.has(op.barrel.id)) continue;
    seenBarrels.add(op.barrel.id);
    recentBarrels.push(op);
    if (recentBarrels.length >= 5) break;
  }

  const barrelOptions: BarrelOption[] = allBarrels.map((b) => ({
    id: b.id,
    number: b.number,
    projectId: b.projectId,
    projectName: b.project.name,
    variety: b.project.variety,
    customerName: b.project.customer.name,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium mb-1">Hoy</h1>
        <p className="text-ink-soft text-sm">Buscá una barrica para registrar una operación en segundos.</p>
      </div>

      <BarrelSearch barrels={barrelOptions} initialQuery={query ?? ""} />

      {query && (
        <div className="flex flex-col gap-2 -mt-4">
          {matches.length === 0 && (
            <p className="text-sm text-ink-faint">Sin resultados para &ldquo;{query}&rdquo;.</p>
          )}
          {matches.map((barrel) => (
            <Link
              key={barrel.id}
              href={`/dashboard/barrels/${barrel.id}/log`}
              className="flex items-center justify-between rounded-lg border border-line-strong bg-surface px-5 py-4 hover:bg-brass-tint transition-colors"
            >
              <div>
                <span className="font-mono text-sm text-brass-strong font-semibold">{barrel.number}</span>
                <span className="block font-display text-lg">{barrel.project.name}</span>
                <span className="block text-sm text-ink-soft">{barrel.project.customer.name}</span>
              </div>
              <Badge tone="neutral">{BARREL_STATUS_LABELS[barrel.status as BarrelStatus]}</Badge>
            </Link>
          ))}
        </div>
      )}

      {!query && recentBarrels.length > 0 && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2 block">
            Barricas recientes
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentBarrels.map((op) => (
              <Link
                key={op.barrel!.id}
                href={`/dashboard/barrels/${op.barrel!.id}/log`}
                className="shrink-0 rounded-lg border border-line-strong bg-surface px-4 py-3 hover:bg-brass-tint transition-colors"
              >
                <span className="block font-mono text-sm font-semibold text-brass-strong">
                  {op.barrel!.number}
                </span>
                <span className="block text-xs text-ink-soft whitespace-nowrap">{op.project.customer.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <CardTitle>Próximas tareas</CardTitle>
          {tasks.length === 0 && <p className="text-sm text-ink-faint">Nada agendado por ahora.</p>}
          <ul className="flex flex-col gap-3 mt-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.barrelId ? `/dashboard/barrels/${t.barrelId}/log` : "/dashboard/barrels"}
                  className="flex items-center justify-between gap-3 group"
                >
                  <span>
                    <span className="block text-sm font-medium group-hover:text-brass-strong">
                      {t.operationType.name}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {t.project.name} {t.barrel ? `· ${t.barrel.number}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-mono text-ink-soft shrink-0">
                    {t.date.toLocaleDateString("es-AR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Actividad reciente</CardTitle>
          <ul className="flex flex-col gap-3 mt-2">
            {recent.map((op) => (
              <li key={op.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium">{op.operationType.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {op.project.name} {op.barrel ? `· ${op.barrel.number}` : ""}
                  </span>
                </span>
                <span className="text-xs font-mono text-ink-soft shrink-0">
                  {op.date.toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
