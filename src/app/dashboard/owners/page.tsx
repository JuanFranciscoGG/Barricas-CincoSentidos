import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CreateOwnerForm } from "@/components/owners/AdminForms";
import { AuditTable } from "@/components/owners/AuditTable";
import { createOwnerAction } from "@/lib/actions/owners-admin";
import { barrelPinBadge, ownerStatusBadge } from "./status";

export default async function OwnersPage() {
  await requireAdminSession();

  const [owners, barrels, audit, gifts] = await Promise.all([
    prisma.owner.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignments: { where: { endedAt: null }, include: { barrel: true } } },
    }),
    prisma.barrel.findMany({
      orderBy: { number: "asc" },
      include: { project: { include: { customer: true } }, ownerships: { where: { endedAt: null }, include: { owner: true } } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.gift.groupBy({ by: ["ownerId"], where: { status: "completed" }, _count: { _all: true } }),
  ]);
  const giftsBy = new Map(gifts.map((g) => [g.ownerId, g._count._all]));
  const unowned = barrels.filter((b) => b.ownerships.length === 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium">Dueños y barricas</h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          Un dueño puede tener varias barricas y una barrica varios dueños. Cada barrica tiene un único PIN, compartido por todos sus dueños, y cada dueño tiene su propia cantidad de botellas para dedicar.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Dueño</th>
                <th className="px-5 py-3 font-medium">Barricas</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Botellas asignadas</th>
                <th className="px-5 py-3 font-medium">Dedicadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {owners.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-ink-faint">
                    Todavía no hay dueños. Creá el primero abajo.
                  </td>
                </tr>
              )}
              {owners.map((o) => {
                const badge = ownerStatusBadge(o.status);
                const remaining = o.assignments.reduce((n, a) => n + a.allocation, 0);
                return (
                  <tr key={o.id}>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/owners/${o.id}`} className="font-medium hover:text-brass-strong">
                        {o.name}
                      </Link>
                      <span className="block text-xs text-ink-faint">{o.phone || o.email || "Sin contacto"}</span>
                    </td>
                    <td className="px-5 py-4">
                      {o.assignments.length === 0 ? (
                        <span className="text-ink-faint">Sin barricas</span>
                      ) : (
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {o.assignments.map((a) => (
                            <Link key={a.id} href={`/dashboard/barrels/${a.barrelId}/pin`} className="font-semibold text-brass-strong hover:underline">
                              {a.barrel.number}
                            </Link>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{o.assignments.length ? remaining : "—"}</td>
                    <td className="px-5 py-4 text-ink-soft">{giftsBy.get(o.id) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Barricas</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Barrica</th>
                  <th className="px-5 py-3 font-medium">Dueños</th>
                  <th className="px-5 py-3 font-medium">PIN compartido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {barrels.map((b) => {
                  const pin = barrelPinBadge(b);
                  return (
                    <tr key={b.id}>
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/barrels/${b.id}/pin`} className="font-semibold text-brass-strong hover:underline">
                          {b.number}
                        </Link>
                        <span className="block text-xs text-ink-faint">{b.project.customer.name}</span>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{b.ownerships.length ? b.ownerships.map((x) => x.owner.name).join(", ") : "Sin dueños"}</td>
                      <td className="px-5 py-3">
                        <Badge tone={pin.tone}>{pin.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        {unowned.length > 0 && <p className="text-xs text-ink-faint mt-2">Las barricas sin dueños siguen mostrando su página pública; solo no se puede editar ni dedicar botellas.</p>}
      </section>

      <Card>
        <CardTitle>Nuevo dueño</CardTitle>
        <p className="text-sm text-ink-soft mb-4">Después de crearlo podés asignarlo a una o más barricas y repartirle botellas.</p>
        <CreateOwnerForm action={createOwnerAction} />
      </Card>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Registro de auditoría</h2>
        <AuditTable rows={audit} />
      </section>
    </div>
  );
}
