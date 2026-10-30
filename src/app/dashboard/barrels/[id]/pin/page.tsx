import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ActionButton, AddForm, AssignmentForm, TokenIssuer } from "@/components/owners/AdminForms";
import { AuditTable } from "@/components/owners/AuditTable";
import {
  addOwnerToBarrelAction,
  issuePinActivationAction,
  issuePinResetAction,
  revokeAssignmentAction,
  revokeBarrelSessionsAction,
  setBarrelAccessAction,
  updateAssignmentAction,
} from "@/lib/actions/owners-admin";
import { getInventory } from "@/lib/owners/service";
import { CoverPhotoForm } from "@/components/owners/CoverPhotoForm";
import { removeBarrelCoverAction, saveBarrelCoverAction } from "@/lib/actions/barrel-cover";
import { DEFAULT_COVER, resolveCover } from "@/lib/barrel-cover";
import { barrelPinBadge } from "@/app/dashboard/owners/status";

/**
 * Admin view of one barrel's ownership: the SHARED PIN, who is assigned,
 * each owner's bottle allocation, and the barrel's gifting history.
 */
export default async function BarrelAccessPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const barrel = await prisma.barrel.findUnique({
    where: { id },
    include: {
      project: { include: { customer: true } },
      ownerships: { include: { owner: true }, orderBy: { startedAt: "asc" } },
      pinTokens: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!barrel) notFound();

  const [inventory, owners, gifts, audit] = await Promise.all([
    getInventory(barrel.id),
    prisma.owner.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
    prisma.gift.findMany({ where: { barrelId: barrel.id }, include: { owner: true }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { targetType: "Barrel", targetId: barrel.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const activeAssignments = barrel.ownerships.filter((o) => !o.endedAt);
  const past = barrel.ownerships.filter((o) => o.endedAt);
  const assigned = new Set(activeAssignments.map((o) => o.ownerId));
  const byAssignment = new Map(inventory.owners.map((o) => [o.assignmentId, o]));
  const pin = barrelPinBadge(barrel);
  const lastToken = barrel.pinTokens[0];
  const tokenLive = Boolean(lastToken && !lastToken.usedAt && !lastToken.revokedAt && lastToken.expiresAt > new Date());
  const locked = barrel.lockedUntil && barrel.lockedUntil > new Date();
  const contacts = activeAssignments.filter((a) => a.owner.status === "active").map((a) => ({ name: a.owner.name, phone: a.owner.phone }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/dashboard/barrels/${barrel.id}`} className="text-sm text-ink-faint hover:text-brass-strong">
          ← Detalles de la barrica
        </Link>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          <h1 className="text-2xl font-medium">{barrel.number}</h1>
          <Badge tone={pin.tone}>{pin.label}</Badge>
        </div>
        <p className="text-sm text-ink-soft mt-1">
          {barrel.project.customer.name} · {barrel.project.variety} {barrel.project.vintage ?? ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>PIN compartido de la barrica</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm mt-3">
            <dt className="text-ink-faint">PIN</dt>
            <dd>{barrel.pinHash ? `Configurado el ${barrel.pinSetAt?.toLocaleDateString("es-AR")}` : "No configurado"}</dd>
            <dt className="text-ink-faint">Enlace pendiente</dt>
            <dd>
              {tokenLive
                ? `${lastToken.purpose === "reset" ? "Restablecimiento" : "Activación"} válido hasta ${lastToken.expiresAt.toLocaleString("es-AR")}`
                : "Ninguno"}
            </dd>
            <dt className="text-ink-faint">Intentos fallidos</dt>
            <dd>{locked ? `Bloqueado hasta ${barrel.lockedUntil!.toLocaleTimeString("es-AR")}` : barrel.failedPinAttempts}</dd>
          </dl>
          <p className="text-xs text-ink-faint mt-3">El PIN nunca se guarda ni se puede consultar: solo existe una huella irreversible.</p>

          <div className="mt-4 border-l-2 border-brass pl-3 text-sm text-ink-soft">
            <strong className="text-ink">Atención:</strong> este PIN es de la barrica y lo usan <strong>todos</strong> sus dueños. Restablecerlo invalida el PIN actual y cierra las sesiones de
            {contacts.length ? ` ${contacts.map((c) => c.name).join(", ")}` : " todos los dueños"}; deberán usar el PIN nuevo.
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {activeAssignments.length === 0 ? (
              <p className="text-sm text-ink-soft">Primero agregá al menos un dueño a la barrica.</p>
            ) : (
              <TokenIssuer
                key="pin-issuer"
                action={barrel.pinHash ? issuePinResetAction.bind(null, barrel.id) : issuePinActivationAction.bind(null, barrel.id)}
                label={barrel.pinHash ? "Restablecer PIN" : tokenLive ? "Generar enlace nuevo" : "Generar enlace para el PIN"}
                variant={barrel.pinHash ? "secondary" : "primary"}
                contacts={contacts}
                barrelNumber={barrel.number}
                confirmText={
                  barrel.pinHash
                    ? `¿Restablecer el PIN de la barrica ${barrel.number}? Afecta a TODOS sus dueños: el PIN actual y todas las sesiones dejan de funcionar de inmediato.`
                    : undefined
                }
              />
            )}
            {barrel.pinHash && (
              <ActionButton
                action={revokeBarrelSessionsAction.bind(null, barrel.id)}
                label="Cerrar todas las sesiones"
                confirmText="¿Cerrar las sesiones abiertas de esta barrica? Todos tendrán que ingresar el PIN de nuevo."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Inventario de la barrica</CardTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm mt-3">
            <dt className="text-ink-faint">Embotelladas</dt>
            <dd>{inventory.bottled ? inventory.total : "Todavía sin embotellar"}</dd>
            <dt className="text-ink-faint">Asignadas a dueños</dt>
            <dd>{inventory.allocated}</dd>
            <dt className="text-ink-faint">Ya dedicadas</dt>
            <dd>{inventory.giftedTotal}</dd>
            <dt className="text-ink-faint">Sin asignar</dt>
            <dd className={inventory.bottled && inventory.unallocated > 0 ? "text-sev-med font-medium" : ""}>
              {inventory.unallocated}
              {inventory.bottled && inventory.unallocated > 0 ? " — pendientes de repartir" : ""}
            </dd>
          </dl>
          <p className="text-xs text-ink-faint mt-3">
            Las botellas de cada dueño salen de las embotelladas del proyecto. La suma de lo asignado más lo ya dedicado nunca puede superar ese total. Si el stock existente no se pudo atribuir a alguien, queda «sin asignar» hasta que lo repartas.
          </p>

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-medium mb-2">Acceso a acciones protegidas</h3>
            {barrel.accessRevoked ? (
              <ActionButton action={setBarrelAccessAction.bind(null, barrel.id, false)} label="Restaurar acceso" variant="primary" />
            ) : (
              <ActionButton
                action={setBarrelAccessAction.bind(null, barrel.id, true)}
                label="Revocar acceso"
                variant="danger"
                confirmText={`¿Revocar el acceso protegido de ${barrel.number}? Nadie podrá editar la historia ni dedicar botellas, ni siquiera con el PIN, hasta que lo restaures.`}
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Foto de portada</CardTitle>
        <div className="mt-4">
          <CoverPhotoForm
            saveAction={saveBarrelCoverAction.bind(null, barrel.id)}
            removeAction={removeBarrelCoverAction.bind(null, barrel.id)}
            currentUrl={resolveCover(barrel.photoUrl) === DEFAULT_COVER ? null : barrel.photoUrl}
            defaultUrl={DEFAULT_COVER}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Dueños y botellas asignadas</CardTitle>
        <div className="mt-4 flex flex-col divide-y divide-line">
          {activeAssignments.length === 0 && <p className="text-sm text-ink-faint py-2">Esta barrica no tiene dueños. Su página pública funciona igual.</p>}
          {activeAssignments.map((a) => {
            const inv = byAssignment.get(a.id);
            return (
              <div key={a.id} className="py-4 flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div>
                    <Link href={`/dashboard/owners/${a.ownerId}`} className="font-medium hover:text-brass-strong">
                      {a.owner.name}
                    </Link>
                    {a.owner.status !== "active" && <span className="ml-2 text-xs text-sev-high">deshabilitado</span>}
                    <span className="block text-xs text-ink-faint">{a.owner.phone || a.owner.email || "Sin contacto"}</span>
                  </div>
                  <div className="text-sm text-ink-soft">
                    Dedicadas {inv?.gifted ?? 0} · Quedan <strong className="text-ink">{inv?.remaining ?? 0}</strong> de {a.allocation}
                  </div>
                </div>
                <AssignmentForm
                  action={updateAssignmentAction.bind(null, a.id)}
                  values={{ allocation: a.allocation, canEditStory: a.canEditStory, canGift: a.canGift }}
                  gifted={inv?.gifted ?? 0}
                />
                <div className="max-w-xs">
                  <ActionButton
                    action={revokeAssignmentAction.bind(null, a.id)}
                    label="Quitar de la barrica"
                    variant="danger"
                    confirmText={`¿Quitar a ${a.owner.name} de ${barrel.number}? Se cierran las sesiones de la barrica y sus dedicatorias quedan registradas. Como conoce el PIN compartido, restablecelo si querés dejarlo fuera del todo.`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 max-w-md">
          <AddForm
            action={addOwnerToBarrelAction.bind(null, barrel.id)}
            fieldName="ownerId"
            label="Agregar un dueño"
            submitLabel="Agregar a la barrica"
            options={owners.filter((o) => !assigned.has(o.id)).map((o) => ({ id: o.id, label: o.name }))}
          />
        </div>

        {past.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Historial de dueños</h2>
            <ul className="text-sm text-ink-soft flex flex-col gap-1">
              {past.map((a) => (
                <li key={a.id}>
                  {a.owner.name} · {a.startedAt.toLocaleDateString("es-AR")} → {a.endedAt!.toLocaleDateString("es-AR")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Botellas dedicadas (privado)</h2>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Dedicada por</th>
                  <th className="px-5 py-3 font-medium">Para</th>
                  <th className="px-5 py-3 font-medium">Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {gifts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-ink-faint">
                      Todavía no se dedicó ninguna botella.
                    </td>
                  </tr>
                )}
                {gifts.map((g) => (
                  <tr key={g.id}>
                    <td className="px-5 py-2.5 text-ink-faint whitespace-nowrap">{g.createdAt.toLocaleString("es-AR")}</td>
                    <td className="px-5 py-2.5">{g.owner.name}</td>
                    <td className="px-5 py-2.5">{g.recipientName}</td>
                    <td className="px-5 py-2.5 text-ink-soft">{g.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-ink-faint mt-2">«Dedicada por» es la persona elegida al dedicar; como el PIN es compartido, no es una verificación de identidad.</p>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-2">Auditoría de esta barrica</h2>
        <AuditTable rows={audit} />
      </section>
    </div>
  );
}
