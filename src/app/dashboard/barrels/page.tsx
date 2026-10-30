import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/CopyButton";
import { getSession } from "@/lib/session";
import { publicWineUrl } from "@/lib/url";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createProject } from "@/lib/actions/projects";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/enums";

/**
 * The single admin entry point for barrels (it replaced the old Proyectos
 * section): every barrel with its client, permanent public URL (what the NFC
 * tag is programmed with) and the actions to manage it. See src/app/wine/[token]
 * for what opens on the other end — the PIN screen.
 */
export default async function BarrelsPage() {
  const session = await getSession();
  const isAdmin = session.role === "owner_admin";
  const [projects, customers] = await Promise.all([
    prisma.wineProject.findMany({
      include: { customer: true, barrels: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Barricas</h1>
        <p className="text-sm text-ink-soft mt-1">
          La URL de cada barrica — la misma que se graba en la etiqueta NFC de la duela. Quien la abre ve la
          pantalla del PIN; solo con el PIN de la barrica entra a su página.
        </p>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-[0.7rem] uppercase tracking-[0.16em] text-ink-soft hover:text-brass-strong underline underline-offset-4 font-[family-name:var(--font-archivo)] w-fit">
          Nueva barrica
        </summary>
        <Card className="mt-3 max-w-lg">
          <form action={createProject} className="flex flex-col gap-3">
            <Field label="Cliente" htmlFor="customerId">
              <Select id="customerId" name="customerId" required defaultValue="">
                <option value="" disabled>
                  Elegí un cliente
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nombre del vino" htmlFor="name">
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
            <Button type="submit" className="mt-1 self-start">
              Crear barrica
            </Button>
          </form>
        </Card>
      </details>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Barrica</th>
                <th className="px-5 py-3 font-medium">URL</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {projects.map((p) => {
                const barrel = p.barrels[0];
                const url = publicWineUrl(p.publicToken);
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/customers/${p.customerId}`}
                        className="font-medium hover:text-brass-strong"
                      >
                        {p.customer.name}
                      </Link>
                      <span className="block text-xs text-ink-faint mt-0.5">
                        {p.variety} {p.vintage ?? ""} · {PROJECT_STATUS_LABELS[p.status as ProjectStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-brass-strong font-semibold">
                        {barrel?.number ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <span className="font-mono text-xs text-ink-soft break-all">{url}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={url} label="Copiar URL" />
                        {barrel && (
                          <Link
                            href={`/dashboard/barrels/${barrel.id}`}
                            className="text-sm text-ink-soft hover:text-brass-strong underline underline-offset-2 self-center"
                          >
                            Ver detalles
                          </Link>
                        )}
                        {isAdmin && barrel && (
                          <Link
                            href={`/dashboard/barrels/${barrel.id}/pin`}
                            className="text-sm text-ink-soft hover:text-brass-strong underline underline-offset-2 self-center"
                          >
                            Ver PIN
                          </Link>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-ink-soft hover:text-brass-strong underline underline-offset-2 self-center"
                        >
                          Abrir vista del cliente
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-sm text-ink-faint">
                    Todavía no hay barricas cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
