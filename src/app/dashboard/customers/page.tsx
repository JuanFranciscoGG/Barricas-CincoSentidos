import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createCustomer } from "@/lib/actions/customers";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium">Clientes</h1>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center hover:bg-surface-2">
                <Link
                  href={`/dashboard/customers/${c.id}`}
                  className="flex flex-1 items-center justify-between px-5 py-4"
                >
                  <div>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-sm text-ink-faint">{c.email}</span>
                  </div>
                  <span className="text-sm text-ink-soft">
                    {c._count.projects} {c._count.projects === 1 ? "proyecto" : "proyectos"}
                  </span>
                </Link>
                <Link
                  href={`/dashboard/customers/${c.id}/edit`}
                  className="px-5 py-4 text-sm font-medium text-brass-strong hover:underline shrink-0"
                >
                  Editar
                </Link>
              </li>
            ))}
            {customers.length === 0 && (
              <li className="px-5 py-6 text-sm text-ink-faint">Todavía no hay clientes cargados.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Nuevo cliente</CardTitle>
          <form action={createCustomer} className="flex flex-col gap-3 mt-3">
            <Field label="Nombre" htmlFor="name">
              <Input id="name" name="name" required />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <Input id="phone" name="phone" />
            </Field>
            <Field label="País" htmlFor="country">
              <Input id="country" name="country" />
            </Field>
            <Button type="submit" className="mt-1">
              Crear cliente
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
