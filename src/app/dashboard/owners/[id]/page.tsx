import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionButton, AddForm, ContactForm } from "@/components/owners/AdminForms";
import { AuditTable } from "@/components/owners/AuditTable";
import { addBarrelToOwnerAction, revokeAssignmentAction, setOwnerStatusAction, updateOwnerAction } from "@/lib/actions/owners-admin";
import { ownerStatusBadge } from "../status";

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const owner = await prisma.owner.findUnique({
    where: { id },
    include: { assignments: { include: { barrel: { include: { project: { include: { customer: true } } } } }, orderBy: { startedAt: "desc" } } },
  });
  if (!owner) notFound();

  const [barrels, gifts, giftCounts, audit] = await Promise.all([
    prisma.barrel.findMany({ include: { project: { include: { customer: true } } }, orderBy: { number: "asc" } }),
    prisma.gift.findMany({ where: { ownerId: owner.id }, include: { barrel: true }, orderBy: { createdAt: "desc" } }),
    prisma.gift.groupBy({ by: ["assignmentId"], where: { ownerId: owner.id, status: "completed" }, _count: { _all: true } }),
    prisma.auditLog.findMany({ where: { targetType: "Owner", targetId: owner.id }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const giftedBy = new Map(giftCounts.map((g) => [g.assignmentId, g._count._all]));

  const active = owner.assignments.filter((a) => !a.endedAt);
  const past = owner.assignments.filter((a) => a.endedAt);
  const taken = new Set(active.map((a) => a.barrelId));
  const badge = ownerStatusBadge(owner.status);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/owners" className="text-sm text-ink-faint hover:text-brass-strong">
          ← Dueños y barricas
        </Link>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <h1 className="text-2xl font-medium">{owner.name}</h1>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>
      </div>

      <Card>
        <CardTitle>Datos de contacto</CardTitle>
        <div className="mt-3">
          <ContactForm action={updateOwnerAction.bind(null, owner.id)} owner={{ name: owner.name, email: owner.email, phone: owner.phone }} />
        </div>
      </Card>

      <Card>
        <CardTitle>Barricas de {owner.name.split(" ")[0]}</CardTitle>
        <p className="text-sm text-ink-soft mt-1">
          El PIN pertenece a cada barrica (no al dueño) y las botellas se asignan por barrica. Para cambiar botellas o permisos, abrí la barrica.
        </p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-4 font-medium">Barrica</th>
                <th className="py-2 pr-4 font-medium">Asignadas</th>
                <th className="py-2 pr-4 font-medium">Dedicadas</th>
                <th className="py-2 pr-4 font-medium">Quedan</th>
                <th className="py-2 pr-4 font-medium">Permisos</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {active.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-5 text-ink-faint">
                    Sin barricas asignadas.
                  </td>
                </tr>
              )}
              {active.map((a) => {
                const gifted = giftedBy.get(a.id) ?? 0;
                return (
                  <tr key={a.id} className="align-top">
                    <td className="py-3 pr-4">
                      <Link href={`/dashboard/barrels/${a.barrelId}/pin`} className="font-semibold text-brass-strong hover:underline">
                        {a.barrel.number}
                      </Link>
                      <span className="block text-xs text-ink-faint">{a.barrel.project.customer.name}</span>
                    </td>
                    <td className="py-3 pr-4">{a.allocation}</td>
                    <td className="py-3 pr-4">{gifted}</td>
                    <td className="py-3 pr-4">{Math.max(0, a.allocation - gifted)}</td>
                    <td className="py-3 pr-4 text-ink-soft">{[a.canEditStory && "historia", a.canGift && "dedicar"].filter(Boolean).join(", ") || "ninguno"}</td>
                    <td className="py-3">
                      <ActionButton
                        action={revokeAssignmentAction.bind(null, a.id)}
                        label="Quitar"
                        variant="danger"
                        confirmText={`¿Quitar a ${owner.name} de la barrica ${a.barrel.number}? Se cierran las sesiones de esa barrica. Sus dedicatorias quedan registradas. Como conoce el PIN compartido, restablecelo si querés dejarlo fuera del todo.`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {owner.status === "active" && (
          <div className="mt-6 max-w-md">
            <AddForm
              action={addBarrelToOwnerAction.bind(null, owner.id)}
              fieldName="barrelId"
              label="Asignar otra barrica"
              submitLabel="Asignar barrica"
              options={barrels.filter((b) => !taken.has(b.id)).map((b) => ({ id: b.id, label: `${b.number} · ${b.project.customer.name}` }))}
            />
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Historial de asignaciones</h2>
            <ul className="text-sm text-ink-soft flex flex-col gap-1">
              {past.map((a) => (
                <li key={a.id}>
                  {a.barrel.number} · {a.startedAt.toLocaleDateString("es-AR")} → {a.endedAt!.toLocaleDateString("es-AR")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Acceso del dueño</CardTitle>
        <p className="text-sm text-ink-soft mt-1 mb-3">
          Un dueño deshabilitado deja de aparecer en la lista para dedicar botellas, en todas sus barricas. Su historial no cambia.
        </p>
        {owner.status === "disabled" ? (
          <ActionButton action={setOwnerStatusAction.bind(null, owner.id, "active")} label="Restaurar dueño" variant="primary" />
        ) : (
          <ActionButton
            action={setOwnerStatusAction.bind(null, owner.id, "disabled")}
            label="Deshabilitar dueño"
            variant="danger"
            confirmText={`¿Deshabilitar a ${owner.name}? No podrá ser elegido al dedicar botellas hasta que lo restaures.`}
          />
        )}
      </Card>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Botellas dedicadas por {owner.name.split(" ")[0]} (privado)</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Barrica</th>
                  <th className="px-5 py-3 font-medium">Para</th>
                  <th className="px-5 py-3 font-medium">Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {gifts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-ink-faint">
                      Todavía no dedicó ninguna botella.
                    </td>
                  </tr>
                )}
                {gifts.map((g) => (
                  <tr key={g.id}>
                    <td className="px-5 py-2.5 text-ink-faint whitespace-nowrap">{g.createdAt.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-2.5">{g.barrel.number}</td>
                    <td className="px-5 py-2.5">{g.recipientName}</td>
                    <td className="px-5 py-2.5 text-ink-soft">{g.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Auditoría de este dueño</h2>
        <AuditTable rows={audit} />
      </section>
    </div>
  );
}
