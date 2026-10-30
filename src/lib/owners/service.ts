import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { comparePin, DUMMY_PIN_HASH, generateToken, hashPin, hashToken, isValidPin } from "./crypto";

/**
 * Framework-free core of the barrel PIN / owner / gifting system.
 *
 * Model in one paragraph: owners and barrels are many-to-many
 * (BarrelOwnership). Each BARREL has one shared PIN; knowing it grants
 * barrel-level access to protected actions but does NOT identify a person.
 * When a bottle is dedicated, the person picks which assigned owner is the
 * giver; the bottle is deducted from that owner's allocation on that barrel.
 *
 * Everything that decides "is this allowed?" re-reads the database. Callers
 * (server actions) never pass trust from the client, and nothing here depends
 * on cookies, so it can be tested directly.
 */

export type AssignmentPermission = "canEditStory" | "canGift";

export interface Actor {
  type: "staff" | "owner" | "barrel" | "system";
  id?: string | null;
  name?: string | null;
}

export class OwnerError extends Error {
  constructor(
    public code: "invalid" | "locked" | "forbidden" | "not_found" | "conflict" | "sold_out" | "validation",
    message: string,
    public retryAfterSec?: number
  ) {
    super(message);
  }
}

export const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_MAX_MS = 12 * 60 * 60 * 1000;
export const FREE_PIN_ATTEMPTS = 5;
const MAX_LOCK_SEC = 60 * 60;
const GENERIC_PIN_ERROR = "PIN incorrecto.";
const FORBIDDEN = "No tenés permiso para realizar esta acción.";

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function audit(
  actor: Actor,
  action: string,
  target?: { type: string; id: string },
  details?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorName: actor.name ?? null,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id ?? null,
      // Callers must never put PINs or tokens in here.
      details: details ? JSON.stringify(details) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Owners (identity + contact only)
// ---------------------------------------------------------------------------

function cleanName(v: string) {
  const name = v.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new OwnerError("validation", "El nombre debe tener entre 2 y 80 caracteres.");
  return name;
}

export async function createOwner(input: { name: string; email?: string | null; phone?: string | null }, actor: Actor) {
  const owner = await prisma.owner.create({
    data: { name: cleanName(input.name), email: input.email?.trim() || null, phone: input.phone?.trim() || null, createdById: actor.id ?? null },
  });
  await audit(actor, "owner.created", { type: "Owner", id: owner.id });
  return owner;
}

export async function updateOwnerContact(ownerId: string, input: { name: string; email?: string | null; phone?: string | null }, actor: Actor) {
  await prisma.owner.update({
    where: { id: ownerId },
    data: { name: cleanName(input.name), email: input.email?.trim() || null, phone: input.phone?.trim() || null },
  });
  await audit(actor, "owner.updated", { type: "Owner", id: ownerId });
}

/** A disabled owner can no longer be selected as a giver on any barrel. History is untouched. */
export async function setOwnerStatus(ownerId: string, status: "active" | "disabled", actor: Actor) {
  await prisma.owner.update({ where: { id: ownerId }, data: { status } });
  await audit(actor, status === "disabled" ? "owner.disabled" : "owner.restored", { type: "Owner", id: ownerId });
}

// ---------------------------------------------------------------------------
// Assignments (owner x barrel)
// ---------------------------------------------------------------------------

export async function assignOwner(
  ownerId: string,
  barrelId: string,
  opts: { allocation?: number; canEditStory?: boolean; canGift?: boolean },
  actor: Actor
) {
  const [owner, barrel] = await Promise.all([prisma.owner.findUnique({ where: { id: ownerId } }), prisma.barrel.findUnique({ where: { id: barrelId } })]);
  if (!owner || !barrel) throw new OwnerError("not_found", "Dueño o barrica no encontrados.");
  if (owner.status !== "active") throw new OwnerError("conflict", "Este dueño está deshabilitado.");
  let created;
  try {
    // Partial unique index: never two ACTIVE rows for the same (barrel, owner).
    created = await prisma.barrelOwnership.create({
      data: { ownerId, barrelId, allocation: 0, canEditStory: opts.canEditStory ?? true, canGift: opts.canGift ?? true, assignedById: actor.id ?? null },
    });
  } catch {
    throw new OwnerError("conflict", "Este dueño ya está asignado a esta barrica.");
  }
  await audit(actor, "assignment.created", { type: "Barrel", id: barrelId }, { ownerId, assignmentId: created.id });
  if (opts.allocation && opts.allocation > 0) {
    try {
      await setAllocation(created.id, opts.allocation, actor);
    } catch (e) {
      // Keep the assignment (with 0 bottles) and surface why the allocation failed.
      throw e;
    }
  }
  return created;
}

/**
 * Remove an owner from a barrel (row kept as history). The barrel's private
 * sessions are cut so everyone has to re-enter the PIN. Because the PIN is
 * shared, the removed person may still KNOW it — resetting the PIN is the
 * only way to fully lock them out, and the admin UI says so.
 */
export async function revokeAssignment(assignmentId: string, actor: Actor, reason = "removed") {
  const a = await prisma.barrelOwnership.findUnique({ where: { id: assignmentId } });
  if (!a || a.endedAt) throw new OwnerError("not_found", "La asignación no existe o ya terminó.");
  await prisma.$transaction([
    prisma.barrelOwnership.update({ where: { id: a.id }, data: { endedAt: new Date(), endedReason: reason } }),
    prisma.barrel.update({ where: { id: a.barrelId }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  await audit(actor, "assignment.revoked", { type: "Barrel", id: a.barrelId }, { ownerId: a.ownerId, assignmentId: a.id, reason });
}

export async function updateAssignmentPermissions(
  assignmentId: string,
  perms: { canEditStory: boolean; canGift: boolean },
  actor: Actor
) {
  const a = await prisma.barrelOwnership.findUnique({ where: { id: assignmentId } });
  if (!a || a.endedAt) throw new OwnerError("not_found", "La asignación no existe o ya terminó.");
  await prisma.$transaction([
    prisma.barrelOwnership.update({ where: { id: a.id }, data: perms }),
    prisma.barrel.update({ where: { id: a.barrelId }, data: { sessionVersion: { increment: 1 } } }),
  ]);
  await audit(actor, "assignment.permissions_changed", { type: "Barrel", id: a.barrelId }, { ownerId: a.ownerId, ...perms });
}

/**
 * Serializes every stock-changing write of one wine project (gifts and allocation changes). The rules
 * below are conditional single statements; PostgreSQL runs concurrent statements side by side, so
 * without this row lock two simultaneous requests could both pass the "is there stock left" check.
 */
async function lockProjectForBarrel(tx: Prisma.TransactionClient, barrelId: string) {
  await tx.$queryRaw`SELECT p."id" FROM "WineProject" p JOIN "Barrel" b ON b."projectId" = p."id" WHERE b."id" = ${barrelId} FOR UPDATE OF p`;
}

/**
 * Set an owner's bottle allocation on a barrel. One conditional UPDATE keeps
 * the rules atomic even against concurrent gifts / other admin edits:
 *   - never below what this owner already dedicated, and
 *   - active allocations of the whole project + bottles already dedicated
 *     under ended assignments can never exceed the bottled inventory.
 */
export async function setAllocation(assignmentId: string, allocation: number, actor: Actor) {
  if (!Number.isInteger(allocation) || allocation < 0 || allocation > 100000) throw new OwnerError("validation", "La asignación debe ser un número entero de 0 o más.");
  const a = await prisma.barrelOwnership.findUnique({ where: { id: assignmentId }, include: { barrel: true } });
  if (!a || a.endedAt) throw new OwnerError("not_found", "La asignación no existe o ya terminó.");

  const updated = await prisma.$transaction(async (tx) => {
    await lockProjectForBarrel(tx, a.barrelId);
    return tx.$executeRaw`
    UPDATE "BarrelOwnership" SET "allocation" = ${allocation}
    WHERE "id" = ${assignmentId} AND "endedAt" IS NULL
      AND ${allocation} >= (SELECT COUNT(*) FROM "Gift" g WHERE g."assignmentId" = "BarrelOwnership"."id" AND g."status" = 'completed')
      AND COALESCE((SELECT "bottleCount" FROM "BottlingRecord" WHERE "projectId" = ${a.barrel.projectId} ORDER BY "bottlingDate" DESC, "createdAt" DESC LIMIT 1), 0)
          >= ${allocation}
             + (SELECT COALESCE(SUM(o2."allocation"), 0) FROM "BarrelOwnership" o2 JOIN "Barrel" b2 ON b2."id" = o2."barrelId"
                 WHERE b2."projectId" = ${a.barrel.projectId} AND o2."endedAt" IS NULL AND o2."id" <> ${assignmentId})
             + (SELECT COUNT(*) FROM "Gift" g2 LEFT JOIN "BarrelOwnership" o3 ON o3."id" = g2."assignmentId"
                 WHERE g2."projectId" = ${a.barrel.projectId} AND g2."status" = 'completed' AND (o3."id" IS NULL OR o3."endedAt" IS NOT NULL))`;
  });
  if (updated !== 1) {
    const gifted = await prisma.gift.count({ where: { assignmentId, status: "completed" } });
    if (allocation < gifted) throw new OwnerError("conflict", `Este dueño ya dedicó ${gifted} ${gifted === 1 ? "botella" : "botellas"}: la asignación no puede ser menor.`);
    const inv = await getInventory(a.barrelId);
    throw new OwnerError("conflict", `Excede el inventario: el máximo para este dueño es ${inv.unallocated + a.allocation} (hay ${inv.total} botellas embotelladas en total).`);
  }
  await audit(actor, "allocation.changed", { type: "Barrel", id: a.barrelId }, { ownerId: a.ownerId, assignmentId, from: a.allocation, to: allocation });
}

// ---------------------------------------------------------------------------
// Shared barrel PIN: activation / reset tokens
// ---------------------------------------------------------------------------

export async function issueBarrelToken(barrelId: string, purpose: "activation" | "reset", actor: Actor, now = new Date()) {
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
  if (!barrel) throw new OwnerError("not_found", "Barrica no encontrada.");
  const active = await prisma.barrelOwnership.count({ where: { barrelId, endedAt: null, owner: { status: "active" } } });
  if (active === 0) throw new OwnerError("conflict", "Asigná al menos un dueño a la barrica antes de configurar su PIN.");
  if (purpose === "activation" && barrel.pinHash) throw new OwnerError("conflict", "Esta barrica ya tiene PIN. Usá «Restablecer PIN».");

  const raw = generateToken();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.barrelPinToken.updateMany({ where: { barrelId, usedAt: null, revokedAt: null }, data: { revokedAt: now } }),
    prisma.barrelPinToken.create({ data: { barrelId, purpose, tokenHash: hashToken(raw), expiresAt, createdById: actor.id ?? null } }),
    ...(purpose === "reset"
      ? [
          // Old PIN stops working NOW, for every owner, and every session is cut.
          prisma.barrel.update({
            where: { id: barrelId },
            data: { pinHash: null, pinSetAt: null, failedPinAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
          }),
        ]
      : []),
  ]);
  await audit(actor, purpose === "reset" ? "barrel.pin_reset_issued" : "barrel.pin_activation_issued", { type: "Barrel", id: barrelId });
  return { token: raw, expiresAt };
}

async function findUsableToken(raw: string, now: Date) {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 200) return null;
  const token = await prisma.barrelPinToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { barrel: true } });
  if (!token || token.usedAt || token.revokedAt || token.expiresAt <= now) return null;
  return token;
}

/** Non-consuming check so the activation page can greet the user. Reveals nothing for bad tokens. */
export async function inspectToken(raw: string, now = new Date()) {
  const token = await findUsableToken(raw, now);
  if (!token) return null;
  return { purpose: token.purpose as "activation" | "reset", barrelNumber: token.barrel.number };
}

/** Spend a token and set the barrel's shared PIN. Single-use even under concurrent requests. */
export async function redeemToken(raw: string, pin: string, pinConfirm: string, now = new Date()) {
  if (!isValidPin(pin)) throw new OwnerError("validation", "El PIN debe tener exactamente 6 números.");
  if (pin !== pinConfirm) throw new OwnerError("validation", "Los PIN no coinciden.");
  const token = await findUsableToken(raw, now);
  if (!token) throw new OwnerError("invalid", "El enlace no es válido o venció. Pedí uno nuevo a la bodega.");

  const pinHash = await hashPin(pin);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.barrelPinToken.updateMany({
      where: { id: token.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new OwnerError("invalid", "El enlace no es válido o venció. Pedí uno nuevo a la bodega.");
    await tx.barrel.update({
      where: { id: token.barrelId },
      data: { pinHash, pinSetAt: now, failedPinAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
    });
  });
  await audit({ type: "barrel", id: token.barrelId }, token.purpose === "reset" ? "barrel.pin_reset_completed" : "barrel.pin_activated", { type: "Barrel", id: token.barrelId });
  return { barrelId: token.barrelId };
}

// ---------------------------------------------------------------------------
// Access switch
// ---------------------------------------------------------------------------

export async function setAccessRevoked(barrelId: string, revoked: boolean, actor: Actor) {
  await prisma.barrel.update({
    where: { id: barrelId },
    data: revoked ? { accessRevoked: true, sessionVersion: { increment: 1 } } : { accessRevoked: false },
  });
  await audit(actor, revoked ? "barrel.access_revoked" : "barrel.access_restored", { type: "Barrel", id: barrelId });
}

export async function revokeBarrelSessions(barrelId: string, actor: Actor) {
  await prisma.barrel.update({ where: { id: barrelId }, data: { sessionVersion: { increment: 1 } } });
  await audit(actor, "barrel.sessions_revoked", { type: "Barrel", id: barrelId });
}

// ---------------------------------------------------------------------------
// PIN verification with escalating lockout (per barrel)
// ---------------------------------------------------------------------------

// Serialize attempts per barrel inside one process so a burst of parallel
// guesses cannot slip past the counter between read and write.
const verifyChains = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = verifyChains.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  verifyChains.set(
    key,
    run.finally(() => {
      if (verifyChains.get(key) === run) verifyChains.delete(key);
    })
  );
  return run;
}

export function lockSecondsFor(failures: number) {
  if (failures < FREE_PIN_ATTEMPTS) return 0;
  return Math.min(MAX_LOCK_SEC, 60 * 2 ** (failures - FREE_PIN_ATTEMPTS));
}

export type PinResult =
  | { ok: true; barrelId: string; sessionVersion: number }
  | { ok: false; locked: boolean; retryAfterSec?: number; message: string };

export function verifyBarrelPin(barrelId: string, pin: string, now = new Date()): Promise<PinResult> {
  return serialized(barrelId, async () => {
    const fail = (): PinResult => ({ ok: false, locked: false, message: GENERIC_PIN_ERROR });
    if (!isValidPin(pin)) {
      await comparePin("000000", DUMMY_PIN_HASH);
      return fail();
    }
    const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
    if (!barrel || barrel.accessRevoked || !barrel.pinHash) {
      await comparePin(pin, DUMMY_PIN_HASH);
      return fail();
    }
    if (barrel.lockedUntil && barrel.lockedUntil > now) {
      return {
        ok: false,
        locked: true,
        retryAfterSec: Math.ceil((barrel.lockedUntil.getTime() - now.getTime()) / 1000),
        message: "Demasiados intentos. Esperá un momento antes de volver a probar.",
      };
    }
    if (await comparePin(pin, barrel.pinHash)) {
      await prisma.barrel.update({ where: { id: barrel.id }, data: { failedPinAttempts: 0, lockedUntil: null } });
      return { ok: true, barrelId: barrel.id, sessionVersion: barrel.sessionVersion };
    }
    const failures = barrel.failedPinAttempts + 1;
    const lockSec = lockSecondsFor(failures);
    await prisma.barrel.update({
      where: { id: barrel.id },
      data: { failedPinAttempts: failures, lockedUntil: lockSec ? new Date(now.getTime() + lockSec * 1000) : null },
    });
    await audit({ type: "system" }, "barrel.pin_failed", { type: "Barrel", id: barrel.id }, { failures });
    if (lockSec) return { ok: false, locked: true, retryAfterSec: lockSec, message: "Demasiados intentos. Esperá un momento antes de volver a probar." };
    return fail();
  });
}

// ---------------------------------------------------------------------------
// Authorization — called for every protected operation
// ---------------------------------------------------------------------------

/**
 * Barrel-level authorization. Valid only while: the barrel has a PIN and is
 * not revoked, the session version still matches (PIN reset / permission or
 * assignment change cuts it), and — for the given permission — at least one
 * ACTIVE owner assignment grants it. The barrel comes from the public URL
 * token resolved on the server, never from the request body, and a session for
 * one barrel says nothing about any other barrel.
 */
export async function authorizeBarrel(barrelId: string, sessionVersion: number, permission?: AssignmentPermission) {
  const barrel = await prisma.barrel.findUnique({ where: { id: barrelId } });
  if (!barrel || barrel.accessRevoked || !barrel.pinHash || barrel.sessionVersion !== sessionVersion) return null;
  const assignments = await prisma.barrelOwnership.findMany({
    where: { barrelId, endedAt: null, owner: { status: "active" } },
    include: { owner: true },
    orderBy: { startedAt: "asc" },
  });
  if (assignments.length === 0) return null;
  if (permission && !assignments.some((a) => a[permission])) return null;
  return { barrel, assignments };
}

// ---------------------------------------------------------------------------
// Inventory + gifting
// ---------------------------------------------------------------------------

/**
 * Inventory view for a barrel. Total = bottles in the project's latest
 * bottling record (aggregate model). Each owner's remaining = allocation minus
 * gifts recorded against their assignment. `unallocated` is what an
 * administrator can still hand out.
 */
export async function getInventory(barrelId: string) {
  const barrel = await prisma.barrel.findUniqueOrThrow({ where: { id: barrelId } });
  const [bottling, assignments, projectAllocs, orphanGifts, giftedTotal, grouped] = await Promise.all([
    prisma.bottlingRecord.findFirst({ where: { projectId: barrel.projectId }, orderBy: [{ bottlingDate: "desc" }, { createdAt: "desc" }] }),
    prisma.barrelOwnership.findMany({ where: { barrelId, endedAt: null }, include: { owner: true }, orderBy: { startedAt: "asc" } }),
    prisma.barrelOwnership.aggregate({ where: { endedAt: null, barrel: { projectId: barrel.projectId } }, _sum: { allocation: true } }),
    prisma.gift.count({ where: { projectId: barrel.projectId, status: "completed", OR: [{ assignmentId: null }, { assignment: { endedAt: { not: null } } }] } }),
    prisma.gift.count({ where: { projectId: barrel.projectId, status: "completed" } }),
    prisma.gift.groupBy({ by: ["assignmentId"], where: { barrelId, status: "completed" }, _count: { _all: true } }),
  ]);
  const total = bottling?.bottleCount ?? 0;
  const giftsBy = new Map(grouped.map((g) => [g.assignmentId, g._count._all]));
  const committed = (projectAllocs._sum.allocation ?? 0) + orphanGifts;
  return {
    total,
    bottled: Boolean(bottling),
    giftedTotal,
    allocated: projectAllocs._sum.allocation ?? 0,
    unallocated: Math.max(0, total - committed),
    owners: assignments.map((a) => {
      const gifted = giftsBy.get(a.id) ?? 0;
      return {
        assignmentId: a.id,
        ownerId: a.ownerId,
        name: a.owner.name,
        ownerActive: a.owner.status === "active",
        canGift: a.canGift,
        canEditStory: a.canEditStory,
        allocation: a.allocation,
        gifted,
        remaining: Math.max(0, a.allocation - gifted),
      };
    }),
  };
}

/** The owners a person may pick as the giver: active assignment, active owner, gifting allowed. */
export async function listGivers(barrelId: string) {
  const inv = await getInventory(barrelId);
  return inv.owners.filter((o) => o.ownerActive && o.canGift);
}

export interface GiftInput {
  ownerId: string;
  recipientName: string;
  message?: string | null;
  idempotencyKey: string;
}

/**
 * Create a gift attributed to a SELECTED owner and deduct one bottle from that
 * owner's allocation in a single SQL statement, so assignment, permission,
 * session version, the owner's remaining allocation and total stock are all
 * checked at the moment of commit — concurrent requests cannot oversell. The
 * unique idempotencyKey makes a repeated submit return the original gift.
 *
 * The shared PIN does not prove who the person is: the selected owner is
 * recorded as the giver, validated only to be an active owner of this barrel.
 */
export async function createGift(auth: { barrelId: string; sessionVersion: number }, input: GiftInput) {
  const recipient = input.recipientName.trim().replace(/\s+/g, " ");
  const message = (input.message ?? "").trim();
  if (recipient.length < 1 || recipient.length > 40) throw new OwnerError("validation", "Escribí el nombre de quien recibe la botella (hasta 40 caracteres).");
  if (message.length > 240) throw new OwnerError("validation", "El mensaje admite hasta 240 caracteres.");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(input.idempotencyKey)) throw new OwnerError("validation", "Solicitud inválida.");
  if (typeof input.ownerId !== "string" || !input.ownerId) throw new OwnerError("validation", "Elegí quién dedica la botella.");

  const allowed = await authorizeBarrel(auth.barrelId, auth.sessionVersion, "canGift");
  if (!allowed) throw new OwnerError("forbidden", FORBIDDEN);
  const assignment = allowed.assignments.find((a) => a.ownerId === input.ownerId && a.canGift);
  if (!assignment) throw new OwnerError("forbidden", "Esa persona no está habilitada para dedicar botellas de esta barrica.");

  const existing = await prisma.gift.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.barrelId !== auth.barrelId) throw new OwnerError("forbidden", FORBIDDEN);
    return { gift: existing, created: false, inventory: await getInventory(auth.barrelId) };
  }

  const id = `gft${generateToken().slice(0, 22)}`;
  const createdAt = new Date();
  let inserted = 0;
  try {
    inserted = await prisma.$transaction(async (tx) => {
      await lockProjectForBarrel(tx, auth.barrelId);
      return tx.$executeRaw`
      INSERT INTO "Gift" ("id","projectId","barrelId","ownerId","assignmentId","recipientName","message","status","idempotencyKey","createdAt")
      SELECT ${id}, b."projectId", b."id", o."id", bo."id", ${recipient}, ${message || null}, 'completed', ${input.idempotencyKey}, ${createdAt}
      FROM "BarrelOwnership" bo
      JOIN "Barrel" b ON b."id" = bo."barrelId"
      JOIN "Owner" o ON o."id" = bo."ownerId"
      WHERE bo."id" = ${assignment.id} AND bo."endedAt" IS NULL AND bo."canGift" = true
        AND o."status" = 'active'
        AND b."accessRevoked" = false AND b."pinHash" IS NOT NULL AND b."sessionVersion" = ${auth.sessionVersion}
        AND bo."allocation" > (SELECT COUNT(*) FROM "Gift" g WHERE g."assignmentId" = bo."id" AND g."status" = 'completed')
        AND COALESCE((SELECT "bottleCount" FROM "BottlingRecord" WHERE "projectId" = b."projectId" ORDER BY "bottlingDate" DESC, "createdAt" DESC LIMIT 1), 0)
            > (SELECT COUNT(*) FROM "Gift" WHERE "projectId" = b."projectId" AND "status" = 'completed')`;
    });
  } catch (e) {
    // Lost a race on the idempotency key: the other request created it.
    const dup = await prisma.gift.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (dup && dup.barrelId === auth.barrelId) return { gift: dup, created: false, inventory: await getInventory(auth.barrelId) };
    throw e;
  }
  if (inserted !== 1) {
    const inv = await getInventory(auth.barrelId);
    const mine = inv.owners.find((o) => o.ownerId === input.ownerId);
    if (!mine || mine.remaining <= 0) throw new OwnerError("sold_out", "Esa persona ya no tiene botellas disponibles para dedicar.");
    throw new OwnerError("sold_out", "Ya no quedan botellas disponibles para dedicar.");
  }
  const gift = await prisma.gift.findUniqueOrThrow({ where: { id } });
  await audit({ type: "barrel", id: auth.barrelId }, "gift.created", { type: "Gift", id }, { barrelId: auth.barrelId, ownerId: input.ownerId, assignmentId: assignment.id });
  return { gift, created: true, inventory: await getInventory(auth.barrelId) };
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

/** Anyone holding the barrel PIN may edit, provided an active owner of the barrel has story rights. */
export async function saveStory(auth: { barrelId: string; sessionVersion: number }, input: { text: string; visible: boolean }) {
  const text = input.text.trim();
  if (text.length === 0 || text.length > 4000) throw new OwnerError("validation", "La historia debe tener entre 1 y 4000 caracteres.");
  const allowed = await authorizeBarrel(auth.barrelId, auth.sessionVersion, "canEditStory");
  if (!allowed) throw new OwnerError("forbidden", FORBIDDEN);
  const projectId = allowed.barrel.projectId;

  await prisma.$transaction([
    prisma.customerStory.upsert({
      where: { projectId },
      update: { text, visible: input.visible },
      create: { projectId, text, visible: input.visible },
    }),
    // The shared PIN cannot say which person edited, so the revision is recorded against the barrel.
    prisma.storyRevision.create({ data: { projectId, text, visible: input.visible, actorType: "barrel", actorId: auth.barrelId, actorName: allowed.barrel.number } }),
  ]);
  await audit({ type: "barrel", id: auth.barrelId }, "story.updated", { type: "WineProject", id: projectId });
}
