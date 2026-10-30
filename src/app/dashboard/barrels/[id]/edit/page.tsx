import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OperationForm, ProjectForm, StageForm } from "@/components/project/ProjectEditForms";
import { updateOperationAction, updateProjectAction, updateStageAction } from "@/lib/actions/project-edit";
import { barrelPath } from "@/lib/admin-routes";
import { toDateInputValue } from "@/lib/dates";

/**
 * Edit an existing project, its stages and its history entries. Each block
 * saves independently (nothing changes until you press Save on that block),
 * and "Volver" leaves without touching anything.
 */
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffSession();
  const { id: barrelId } = await params;
  const barrelRow = await prisma.barrel.findUnique({ where: { id: barrelId }, select: { projectId: true } });
  if (!barrelRow) notFound();
  const id = barrelRow.projectId;
  const base = barrelPath(barrelId);

  const project = await prisma.wineProject.findUnique({
    where: { id },
    include: {
      customer: true,
      stages: { orderBy: { sortOrder: "asc" } },
      operations: { include: { operationType: true, barrel: true }, orderBy: { date: "desc" } },
    },
  });
  if (!project) notFound();

  const [types, regions, varieties] = await Promise.all([
    prisma.operationType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.knowledgeEntry.findMany({ where: { topic: { key: "region" }, OR: [{ status: "published" }, { key: project.originKnowledgeKey ?? "" }] }, orderBy: { title: "asc" } }),
    prisma.knowledgeEntry.findMany({ where: { topic: { key: "variety" }, OR: [{ status: "published" }, { key: project.varietyKnowledgeKey ?? "" }] }, orderBy: { title: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div>
        <Link href={base} className="text-sm text-ink-faint hover:text-brass-strong">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-medium mt-1">Editar proyecto</h1>
        <p className="text-sm text-ink-soft mt-1">
          {project.customer.name}. Los cambios actualizan el proyecto existente y se reflejan en la página pública de la barrica. Las barricas, los dueños, el inventario y las fotos no se modifican desde acá.
        </p>
      </div>

      <Card>
        <CardTitle>Datos del proyecto</CardTitle>
        <div className="mt-3">
          <ProjectForm
            action={updateProjectAction.bind(null, project.id)}
            regions={regions.map((r) => ({ key: r.key, title: r.title }))}
            varieties={varieties.map((r) => ({ key: r.key, title: r.title }))}
            values={{
              name: project.name,
              variety: project.variety,
              vintage: project.vintage?.toString() ?? "",
              vineyard: project.vineyard ?? "",
              origin: project.origin ?? "",
              volumeLiters: project.volumeLiters?.toString() ?? "",
              alcohol: project.alcohol?.toString() ?? "",
              startDate: toDateInputValue(project.startDate),
              estimatedAgingMonths: project.estimatedAgingMonths?.toString() ?? "",
              status: project.status,
              originKnowledgeKey: project.originKnowledgeKey ?? "",
              varietyKnowledgeKey: project.varietyKnowledgeKey ?? "",
              notes: project.notes ?? "",
            }}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Etapas</CardTitle>
        <div className="divide-y divide-line mt-2">
          {project.stages.length === 0 && <p className="text-sm text-ink-faint py-3">Este proyecto no tiene etapas.</p>}
          {project.stages.map((s) => (
            <StageForm
              key={s.id}
              action={updateStageAction.bind(null, project.id, s.id)}
              values={{ name: s.name, startedAt: toDateInputValue(s.startedAt), completedAt: toDateInputValue(s.completedAt) }}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Historial</CardTitle>
        <div className="divide-y divide-line mt-2">
          {project.operations.length === 0 && <p className="text-sm text-ink-faint py-3">Todavía no hay operaciones registradas.</p>}
          {project.operations.map((op) => (
            <div key={op.id}>
              <div className="flex items-center gap-2 pt-4">
                <span className="font-medium text-sm">{op.operationType.name}</span>
                {!op.completed && <Badge tone="med">Tarea</Badge>}
              </div>
              <OperationForm
                action={updateOperationAction.bind(null, project.id, op.id)}
                types={types
                  .filter((t) => t.active || t.id === op.operationTypeId)
                  .map((t) => ({ id: t.id, name: t.active ? t.name : `${t.name} (archivado)` }))}
                barrel={op.barrel?.number ?? null}
                values={{
                  operationTypeId: op.operationTypeId,
                  date: toDateInputValue(op.date),
                  notes: op.notes ?? "",
                  customerVisible: op.customerVisible,
                  featured: op.featured,
                  customerHeadline: op.customerHeadline ?? "",
                  customerNote: op.customerNote ?? "",
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      <div>
        <Link href={base} className="text-sm text-ink-soft hover:text-brass-strong underline underline-offset-4">
          Volver a la barrica
        </Link>
      </div>
    </div>
  );
}
