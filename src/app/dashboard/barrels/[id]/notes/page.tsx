import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth-guard";
import { Card, CardTitle } from "@/components/ui/Card";
import { NewNoteForm, NoteForm } from "@/components/project/NoteForms";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/lib/actions/barrel-notes";
import { barrelPath } from "@/lib/admin-routes";
import { toDateInputValue } from "@/lib/dates";

/**
 * Winery notes for the public "Lo último" section. Notes are separate from
 * tasks: publishing one does not create an operation, change the history or add a stage.
 */
export default async function ProjectNotesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffSession();
  const { id: barrelId } = await params;
  const barrelRow = await prisma.barrel.findUnique({ where: { id: barrelId }, select: { projectId: true } });
  if (!barrelRow) notFound();
  const id = barrelRow.projectId;
  const base = barrelPath(barrelId);

  const project = await prisma.wineProject.findUnique({
    where: { id },
    include: {
      barrels: { orderBy: { createdAt: "asc" } },
      customer: true,
    },
  });
  if (!project) notFound();

  const notes = await prisma.barrelNote.findMany({
    where: { barrel: { projectId: id } },
    include: { barrel: true },
    orderBy: { publishedAt: "desc" },
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalInput = (d: Date) => `${toDateInputValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <Link href={base} className="text-sm text-ink-faint hover:text-brass-strong">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-medium mt-1">Notas de «Lo último»</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          Publicá una novedad corta para la página pública de la barrica. «Lo último» muestra siempre lo más reciente entre esta nota y la última tarea destacada. Las notas no crean tareas ni etapas.
        </p>
      </div>

      <Card>
        <CardTitle>Nueva nota</CardTitle>
        <div className="mt-3">
          {project.barrels.length === 0 ? (
            <p className="text-sm text-ink-faint">Este proyecto no tiene barricas todavía.</p>
          ) : (
            <NewNoteForm action={createNoteAction.bind(null, project.id)} barrels={project.barrels.map((b) => ({ id: b.id, label: `${b.number}${b.type ? ` · ${b.type}` : ""}` }))} />
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Notas publicadas</CardTitle>
        <div className="divide-y divide-line mt-2">
          {notes.length === 0 && <p className="text-sm text-ink-faint py-3">Todavía no hay notas. «Lo último» muestra la última tarea destacada, como siempre.</p>}
          {notes.map((n) => (
            <NoteForm
              key={n.id}
              saveAction={updateNoteAction.bind(null, project.id, n.id)}
              deleteAction={deleteNoteAction.bind(null, project.id, n.id)}
              barrel={n.barrel.number}
              values={{ title: n.title, body: n.body ?? "", publishedAt: toLocalInput(n.publishedAt) }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
