import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createBottlingRecord } from "@/lib/actions/bottling";
import { LABEL_STATUSES, LABEL_STATUS_LABELS, type LabelStatus } from "@/lib/enums";

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NewBottlingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: barrelId } = await params;
  const barrelRow = await prisma.barrel.findUnique({ where: { id: barrelId }, select: { projectId: true } });
  if (!barrelRow) notFound();
  const id = barrelRow.projectId;
  const project = await prisma.wineProject.findUnique({
    where: { id },
    include: { customer: true, barrels: true },
  });
  if (!project) notFound();

  const barrel = project.barrels.find((b) => b.id === barrelId) ?? project.barrels[0];

  return (
    <div className="max-w-lg mx-auto">
      <p className="text-sm text-ink-faint mb-1">{project.customer.name}</p>
      <h1 className="text-2xl font-medium mb-1">Embotellado — {project.name}</h1>
      <p className="text-sm text-ink-soft mb-6">
        Este es el gran hito del vino. Los datos que cargues acá arman la ficha final que ve el
        cliente.
      </p>

      <form action={createBottlingRecord} className="flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />

        <Field label="Fecha de embotellado" htmlFor="bottlingDate">
          <Input id="bottlingDate" name="bottlingDate" type="date" defaultValue={today()} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Litros obtenidos" htmlFor="litersObtained">
            <Input
              id="litersObtained"
              name="litersObtained"
              type="number"
              step="0.1"
              inputMode="decimal"
              defaultValue={barrel?.volumeLiters ?? undefined}
            />
          </Field>
          <Field label="Botellas" htmlFor="bottleCount">
            <Input id="bottleCount" name="bottleCount" type="number" inputMode="numeric" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Formato" htmlFor="bottleFormat">
            <Input id="bottleFormat" name="bottleFormat" defaultValue="750ml" />
          </Field>
          <Field label="Etiqueta" htmlFor="labelStatus">
            <Select id="labelStatus" name="labelStatus" defaultValue="undecided">
              {LABEL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LABEL_STATUS_LABELS[s as LabelStatus]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Foto (opcional)" htmlFor="photo">
          <Input id="photo" name="photo" type="file" accept="image/*" className="py-2" />
        </Field>

        <Field label="Notas (opcional)" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} />
        </Field>

        <Button type="submit" size="md" className="py-3.5 text-base mt-1">
          Registrar embotellado
        </Button>
      </form>
    </div>
  );
}
