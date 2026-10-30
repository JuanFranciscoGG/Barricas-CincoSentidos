import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LogForm } from "./LogForm";
import { suggestNextOperation } from "@/lib/operation-catalog";

export default async function LogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ barrel?: string; saved?: string }>;
}) {
  const { id: barrelId } = await params;
  const { barrel, saved } = await searchParams;

  const barrelRow = await prisma.barrel.findUnique({ where: { id: barrelId }, select: { projectId: true } });
  if (!barrelRow) notFound();
  const id = barrelRow.projectId;

  const [project, operationTypes, lastOperation, completedOps] = await Promise.all([
    prisma.wineProject.findUnique({
      where: { id },
      include: { barrels: true, stages: { orderBy: { sortOrder: "asc" } }, customer: true },
    }),
    prisma.operationType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.operation.findFirst({
      where: { projectId: id, completed: true },
      include: { operationType: true },
      orderBy: { date: "desc" },
    }),
    prisma.operation.findMany({
      where: { projectId: id, completed: true, barrelId: { not: null } },
      select: { operationTypeId: true, barrelId: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!project) notFound();

  const currentStage = project.stages.find((s) => !s.completedAt) ?? project.stages[0] ?? null;
  const selectedBarrel = project.barrels.find((b) => b.id === (barrel || barrelId)) ?? project.barrels[0];

  // Catalog order is the menu order. The suggestion is per barrel (newest
  // history first) and only highlights — any type can still be picked.
  const suggestedByBarrel: Record<string, string | null> = {};
  for (const b of project.barrels) {
    const done = completedOps.filter((o) => o.barrelId === b.id).map((o) => o.operationTypeId);
    suggestedByBarrel[b.id] = suggestNextOperation(operationTypes, done);
  }

  return (
    <div className="max-w-lg mx-auto">
      {saved && (
        <div className="rounded-md bg-sev-low-bg text-sev-low px-4 py-2.5 text-sm mb-5">
          Guardado. Podés cargar otra operación.
        </div>
      )}

      <p className="text-sm text-ink-faint mb-1">{project.customer.name}</p>
      <h1 className="text-2xl font-medium mb-1">{project.name}</h1>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-soft mb-6">
        {selectedBarrel && (
          <span className="font-mono font-semibold text-brass-strong">{selectedBarrel.number}</span>
        )}
        {currentStage && <span>· Etapa: {currentStage.name}</span>}
        {lastOperation && (
          <span>
            · Última: {lastOperation.operationType.name},{" "}
            {lastOperation.date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>

      <LogForm
        projectId={project.id}
        barrels={project.barrels}
        stages={project.stages}
        operationTypes={operationTypes}
        suggestedByBarrel={suggestedByBarrel}
        defaultBarrelId={barrel || barrelId}
        defaultStageId={currentStage?.id}
      />
    </div>
  );
}
