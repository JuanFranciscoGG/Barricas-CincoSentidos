import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteCustomerButton } from "@/components/DeleteCustomerButton";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateCustomer } from "@/lib/actions/customers";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      <div>
        <Link
          href={`/dashboard/customers/${customer.id}`}
          className="text-sm text-ink-faint hover:text-brass-strong"
        >
          ← {customer.name}
        </Link>
        <h1 className="text-2xl font-medium mt-1">Editar cliente</h1>
      </div>

      <Card>
        <CardTitle>Datos del cliente</CardTitle>
        <form action={updateCustomer} className="flex flex-col gap-3 mt-3">
          <input type="hidden" name="id" value={customer.id} />
          <Field label="Nombre" htmlFor="name">
            <Input id="name" name="name" defaultValue={customer.name} required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={customer.email} required />
          </Field>
          <Field label="Teléfono" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} />
          </Field>
          <Field label="País" htmlFor="country">
            <Input id="country" name="country" defaultValue={customer.country ?? ""} />
          </Field>
          <Field label="Notas internas" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={4} defaultValue={customer.notes ?? ""} />
          </Field>
          <div className="flex gap-3 mt-1">
            <Button type="submit">Guardar cambios</Button>
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="text-sm text-ink-soft self-center hover:text-brass-strong"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Zona de peligro</CardTitle>
        <div className="flex items-center justify-between gap-4 mt-3">
          <p className="text-sm text-ink-soft">
            Elimina al cliente y todos sus proyectos. No se puede deshacer.
          </p>
          <DeleteCustomerButton
            id={customer.id}
            name={customer.name}
            projectCount={customer._count.projects}
          />
        </div>
      </Card>
    </div>
  );
}
