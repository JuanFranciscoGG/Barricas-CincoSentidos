import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/enums";
import { createProject } from "@/lib/actions/projects";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { projects: { orderBy: { createdAt: "desc" }, include: { barrels: { orderBy: { createdAt: "asc" }, take: 1 } } } },
  });

  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/customers" className="text-sm text-ink-faint hover:text-brass-strong">
            ← Clientes
          </Link>
          <h1 className="text-2xl font-medium mt-1">{customer.name}</h1>
          <p className="text-sm text-ink-soft">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ""}
            {customer.country ? ` · ${customer.country}` : ""}
          </p>
          {customer.notes && (
            <p className="text-sm text-ink-faint mt-2 whitespace-pre-line">{customer.notes}</p>
          )}
        </div>
        <Link
          href={`/dashboard/customers/${customer.id}/edit`}
          className="text-sm font-medium text-brass-strong hover:underline shrink-0"
        >
          Editar
        </Link>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {customer.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.barrels[0] ? `/dashboard/barrels/${p.barrels[0].id}` : "/dashboard/barrels"}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-2"
                >
                  <div>
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-sm text-ink-faint">
                      {p.variety} {p.vintage ?? ""}
                    </span>
                  </div>
                  <Badge tone="brass">{PROJECT_STATUS_LABELS[p.status as ProjectStatus]}</Badge>
                </Link>
              </li>
            ))}
            {customer.projects.length === 0 && (
              <li className="px-5 py-6 text-sm text-ink-faint">Sin proyectos todavía.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Nuevo proyecto</CardTitle>
          <form action={createProject} className="flex flex-col gap-3 mt-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field label="Nombre del proyecto" htmlFor="name">
              <Input id="name" name="name" placeholder="Ej. El Malbec de Juan" required />
            </Field>
            <Field label="Variedad" htmlFor="variety">
              <Input id="variety" name="variety" placeholder="Malbec" required />
            </Field>
            <Field label="Añada" htmlFor="vintage">
              <Input id="vintage" name="vintage" type="number" placeholder="2026" />
            </Field>
            <Field label="Origen" htmlFor="origin">
              <Input id="origin" name="origin" placeholder="Agrelo, Luján de Cuyo, Mendoza" />
            </Field>
            <Field label="Número de barrica" htmlFor="barrelNumber">
              <Input id="barrelNumber" name="barrelNumber" placeholder="CS-025" required />
            </Field>
            <Button type="submit" className="mt-1">
              Crear proyecto
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
