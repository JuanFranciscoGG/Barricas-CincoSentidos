import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { PROJECT_STATUS_LABELS, BARREL_STATUS_LABELS, type ProjectStatus, type BarrelStatus } from "@/lib/enums";
import { createStage } from "@/lib/actions/operations";
import { updateStory } from "@/lib/actions/story";
import { DuelaCard } from "@/components/DuelaCard";
import { publicWineUrl } from "@/lib/url";
import { barrelPath } from "@/lib/admin-routes";
import { getSession } from "@/lib/session";
import { getInventory } from "@/lib/owners/service";
import { barrelPinBadge } from "@/app/dashboard/owners/status";

/**
 * Barrel details: everything about the barrel and its wine project in one place
 * (data, stages, history, story, public link). PIN, owners and bottle
 * allocations live one click away on the admin-only "Ver PIN" page.
 */
export default async function BarrelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ logged?: string }>;
}) {
  const { id: barrelId } = await params;
  const { logged } = await searchParams;
  const base = barrelPath(barrelId);

  const barrelRow = await prisma.barrel.findUnique({ where: { id: barrelId }, select: { projectId: true } });
  if (!barrelRow) notFound();
  const id = barrelRow.projectId;
  const isAdmin = (await getSession()).role === "owner_admin";

  const project = await prisma.wineProject.findUnique({
    where: { id },
    include: {
      customer: true,
      barrels: true,
      stages: { orderBy: { sortOrder: "asc" } },
      operations: {
        include: { operationType: true, barrel: true },
        orderBy: { date: "desc" },
      },
      story: true,
    },
  });

  if (!project) notFound();

  const barrel = project.barrels.find((b) => b.id === barrelId)!;
  const adminInfo = isAdmin
    ? await Promise.all([
        getInventory(barrelId),
        prisma.barrelOwnership.count({ where: { barrelId, endedAt: null, owner: { status: "active" } } }),
      ])
    : null;

  const daysAging = project.startDate
    ? Math.floor((new Date().getTime() - project.startDate.getTime()) / 86_400_000)
    : null;

  return (
    <div className="flex flex-col gap-8">
      {logged && (
        <div className="rounded-md bg-sev-low-bg text-sev-low px-4 py-2.5 text-sm">
          Operación registrada.
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard/barrels" className="text-sm text-ink-faint hover:text-brass-strong">
            ← Barricas
          </Link>
          <Link href={`/dashboard/customers/${project.customerId}`} className="block text-sm text-ink-faint hover:text-brass-strong mt-1">
            {project.customer.name}
          </Link>
          <h1 className="text-2xl font-medium mt-0.5">
            <span className="font-mono text-brass-strong">{barrel.number}</span> · {project.name}
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            {project.variety} {project.vintage ?? ""} · {project.origin}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brass">{PROJECT_STATUS_LABELS[project.status as ProjectStatus]}</Badge>
          <Link href={`${base}/edit`}>
            <Button variant="secondary">Editar datos</Button>
          </Link>
          <Link href={`${base}/notes`}>
            <Button variant="secondary">Notas de «Lo último»</Button>
          </Link>
          <Link href={`${base}/bottling/new`}>
            <Button variant="secondary">Registrar embotellado</Button>
          </Link>
          <Link href={`${base}/log`}>
            <Button>Registrar operación</Button>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <span className="text-xs uppercase tracking-wide text-ink-faint">Días en crianza</span>
          <p className="text-3xl font-display mt-1">{daysAging ?? "—"}</p>
        </Card>
        <Card>
          <span className="text-xs uppercase tracking-wide text-ink-faint">Volumen</span>
          <p className="text-3xl font-display mt-1">{project.volumeLiters ?? "—"} L</p>
        </Card>
        <Card>
          <span className="text-xs uppercase tracking-wide text-ink-faint">Alcohol</span>
          <p className="text-3xl font-display mt-1">{project.alcohol ?? "—"}%</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <CardTitle>Barricas</CardTitle>
          <ul className="flex flex-col gap-3 mt-2">
            {project.barrels.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>
                  <Link href={barrelPath(b.id)} className="font-mono text-sm font-semibold text-brass-strong hover:underline">{b.number}</Link>
                  <span className="block text-xs text-ink-faint">{b.type}</span>
                </span>
                <Badge>{BARREL_STATUS_LABELS[b.status as BarrelStatus]}</Badge>
              </li>
            ))}
            {project.barrels.length === 0 && (
              <p className="text-sm text-ink-faint">Sin barricas asociadas todavía.</p>
            )}
          </ul>
        </Card>

        <DuelaCard url={publicWineUrl(project.publicToken)} />

        {adminInfo && (
          <Card>
            <CardTitle>Acceso, dueños e inventario</CardTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm mt-3">
              <dt className="text-ink-faint">PIN</dt>
              <dd><Badge tone={barrelPinBadge(barrel).tone}>{barrelPinBadge(barrel).label}</Badge></dd>
              <dt className="text-ink-faint">Dueños activos</dt>
              <dd>{adminInfo[1]}</dd>
              <dt className="text-ink-faint">Embotelladas</dt>
              <dd>{adminInfo[0].bottled ? adminInfo[0].total : "Todavía sin embotellar"}</dd>
              <dt className="text-ink-faint">Asignadas · dedicadas</dt>
              <dd>{adminInfo[0].allocated} · {adminInfo[0].giftedTotal}</dd>
              <dt className="text-ink-faint">Sin asignar</dt>
              <dd>{adminInfo[0].unallocated}</dd>
            </dl>
            <Link href={`${base}/pin`} className="inline-block mt-4 text-sm text-brass-strong underline underline-offset-4">
              Ver PIN, dueños y botellas →
            </Link>
          </Card>
        )}

        <Card>
          <CardTitle>Historia de la barrica</CardTitle>
          <p className="text-sm text-ink-soft mb-4">
            El cliente cuenta su historia de palabra — vos la transcribís acá. Se muestra en la
            página pública de la barrica cuando está marcada como visible.
          </p>
          <form action={updateStory} className="flex flex-col gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <Textarea
              name="text"
              rows={5}
              defaultValue={project.story?.text ?? ""}
              placeholder="Por ejemplo: esta barrica es para el casamiento de mi hija…"
              className="font-display text-base leading-relaxed"
            />
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="visible"
                defaultChecked={project.story?.visible ?? false}
                className="accent-brass"
              />
              Mostrar esta historia en la página pública de la barrica
            </label>
            <Button type="submit" variant="secondary" size="sm" className="self-start">
              Guardar historia
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Etapas</CardTitle>
          <ul className="flex flex-col gap-2.5 mt-2">
            {project.stages.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className={s.completedAt ? "text-ink-faint line-through" : "font-medium"}>
                  {s.name}
                </span>
                <span className="text-xs text-ink-faint">
                  {s.completedAt
                    ? "Completa"
                    : s.startedAt
                      ? "En curso"
                      : "Pendiente"}
                </span>
              </li>
            ))}
          </ul>
          <form action={createStage} className="flex gap-2 mt-4">
            <input type="hidden" name="projectId" value={project.id} />
            <Input name="name" placeholder="Nueva etapa" className="text-sm" />
            <Button type="submit" variant="secondary" size="sm">
              Agregar
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Historial</CardTitle>
        <ul className="flex flex-col gap-4 mt-3">
          {project.operations.map((op) => (
            <li key={op.id} className="flex items-start justify-between gap-4 border-b border-line pb-4 last:border-0 last:pb-0">
              <div>
                <span className="font-medium text-sm">{op.operationType.name}</span>
                {!op.completed && (
                  <span className="ml-2">
                    <Badge tone="med">Tarea</Badge>
                  </span>
                )}
                {op.notes && <p className="text-sm text-ink-soft mt-1">{op.notes}</p>}
                <p className="text-xs text-ink-faint mt-1">
                  {op.barrel?.number} {op.customerVisible ? "· Visible para el cliente" : ""}
                </p>
              </div>
              <span className="text-xs font-mono text-ink-soft shrink-0">
                {op.date.toLocaleDateString("es-AR")}
              </span>
            </li>
          ))}
          {project.operations.length === 0 && (
            <p className="text-sm text-ink-faint">Todavía no hay operaciones registradas.</p>
          )}
        </ul>
      </Card>
    </div>
  );
}
