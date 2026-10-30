"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { endBarrelSession, getBarrelAccess, startBarrelSession } from "@/lib/owner-session";
import { createGift, getInventory, inspectToken, OwnerError, redeemToken, saveStory, verifyBarrelPin } from "@/lib/owners/service";

/**
 * Server actions behind the public wine page. The URL token only identifies
 * *which barrel the person is looking at*; it is never proof of anything.
 * Every protected action requires a valid private session FOR THAT BARREL
 * (entered with the barrel's shared PIN) and is re-authorized on the server.
 *
 * The shared PIN proves access to the barrel, not identity: when dedicating a
 * bottle the person selects which assigned owner is the giver.
 */

export interface OwnerPanel {
  authenticated: true;
  barrelNumber: string;
  canEditStory: boolean;
  canGift: boolean;
  inventory: { total: number; giftedTotal: number; unallocated: number; bottled: boolean };
  /** Owners selectable as giver (active assignment, gifting allowed). */
  givers: { ownerId: string; name: string; allocation: number; gifted: number; remaining: number }[];
  story: { text: string; visible: boolean };
  gifts: { id: string; recipientName: string; message: string | null; giverName: string; createdAt: string }[];
}
export type OwnerStatus = { authenticated: false; ownerConfigured: boolean } | OwnerPanel;

async function barrelByToken(token: string) {
  if (typeof token !== "string" || token.length < 8 || token.length > 64) return null;
  const project = await prisma.wineProject.findUnique({
    where: { publicToken: token },
    include: { story: true, barrels: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const barrel = project?.barrels[0];
  return project && barrel ? { project, barrel } : null;
}

function fail(e: unknown): { ok: false; error: string; retryAfterSec?: number } {
  if (e instanceof OwnerError) return { ok: false, error: e.message, retryAfterSec: e.retryAfterSec };
  console.error("owner action failed", e instanceof Error ? e.message : "unknown error");
  return { ok: false, error: "No pudimos completar la acción. Probá de nuevo." };
}

const EXPIRED = { ok: false as const, error: "Tu sesión venció. Ingresá el PIN de nuevo.", needsPin: true };

/** Private data is only returned with a valid session for this barrel; everyone else learns only whether PIN access exists. */
export async function getOwnerStatus(token: string): Promise<OwnerStatus> {
  const found = await barrelByToken(token);
  if (!found) return { authenticated: false, ownerConfigured: false };
  const { project, barrel } = found;
  const access = await getBarrelAccess(barrel.id);
  if (!access) {
    return { authenticated: false, ownerConfigured: Boolean(barrel.pinHash) && !barrel.accessRevoked };
  }
  const [inventory, gifts] = await Promise.all([
    getInventory(barrel.id),
    prisma.gift.findMany({ where: { barrelId: barrel.id }, include: { owner: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return {
    authenticated: true,
    barrelNumber: barrel.number,
    canEditStory: access.assignments.some((a) => a.canEditStory),
    canGift: access.assignments.some((a) => a.canGift),
    inventory: { total: inventory.total, giftedTotal: inventory.giftedTotal, unallocated: inventory.unallocated, bottled: inventory.bottled },
    givers: inventory.owners
      .filter((o) => o.ownerActive && o.canGift)
      .map((o) => ({ ownerId: o.ownerId, name: o.name, allocation: o.allocation, gifted: o.gifted, remaining: o.remaining })),
    story: { text: project.story?.text ?? "", visible: project.story?.visible ?? false },
    gifts: gifts.map((g) => ({ id: g.id, recipientName: g.recipientName, message: g.message, giverName: g.owner.name, createdAt: g.createdAt.toISOString() })),
  };
}

export async function unlockWithPin(token: string, pin: string): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec?: number }> {
  try {
    const found = await barrelByToken(token);
    // Same message whether the barrel has no PIN yet, is revoked, or the PIN is wrong.
    if (!found) return { ok: false, error: "PIN incorrecto." };
    const result = await verifyBarrelPin(found.barrel.id, String(pin ?? ""));
    if (!result.ok) return { ok: false, error: result.message, retryAfterSec: result.retryAfterSec };
    await startBarrelSession(result.barrelId, result.sessionVersion);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Slides the idle window while the page is open. False = the session is gone, so the client re-renders into the PIN screen. */
export async function keepSessionAlive(token: string): Promise<boolean> {
  const found = await barrelByToken(token);
  return Boolean(found && (await getBarrelAccess(found.barrel.id, undefined, true)));
}

export async function lockOwnerSession(token: string) {
  const found = await barrelByToken(token);
  if (found) await endBarrelSession(found.barrel.id);
}

export async function saveOwnerStory(token: string, text: string, visible: boolean) {
  try {
    const found = await barrelByToken(token);
    const access = found ? await getBarrelAccess(found.barrel.id, "canEditStory", true) : null;
    if (!found || !access) return EXPIRED;
    await saveStory({ barrelId: found.barrel.id, sessionVersion: access.sessionVersion }, { text: String(text ?? ""), visible: Boolean(visible) });
    revalidatePath(`/wine/${found.project.publicToken}`);
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}

export async function giftBottle(token: string, input: { ownerId: string; recipientName: string; message?: string; idempotencyKey: string }) {
  try {
    const found = await barrelByToken(token);
    const access = found ? await getBarrelAccess(found.barrel.id, "canGift", true) : null;
    if (!found || !access) return EXPIRED;
    const result = await createGift(
      { barrelId: found.barrel.id, sessionVersion: access.sessionVersion },
      {
        ownerId: String(input.ownerId ?? ""),
        recipientName: String(input.recipientName ?? ""),
        message: input.message ? String(input.message) : null,
        idempotencyKey: String(input.idempotencyKey ?? ""),
      }
    );
    const giver = result.inventory.owners.find((o) => o.ownerId === result.gift.ownerId);
    return {
      ok: true as const,
      created: result.created,
      giverName: giver?.name ?? "",
      giverRemaining: giver?.remaining ?? 0,
      gift: { id: result.gift.id, recipientName: result.gift.recipientName, message: result.gift.message, createdAt: result.gift.createdAt.toISOString() },
    };
  } catch (e) {
    return fail(e);
  }
}

// --- Activation / PIN reset (public page, protected by the single-use token) ---

export async function previewActivation(rawToken: string) {
  const info = await inspectToken(String(rawToken ?? ""));
  return info ? { valid: true as const, purpose: info.purpose, barrelNumber: info.barrelNumber } : { valid: false as const };
}

export async function completeActivation(rawToken: string, pin: string, pinConfirm: string) {
  try {
    const { barrelId } = await redeemToken(String(rawToken ?? ""), String(pin ?? ""), String(pinConfirm ?? ""));
    const barrel = await prisma.barrel.findUniqueOrThrow({ where: { id: barrelId }, include: { project: true } });
    // They just proved possession of the single-use link and chose the PIN, so open a private
    // session for this barrel and send them back to it.
    await startBarrelSession(barrel.id, barrel.sessionVersion);
    return { ok: true as const, wineToken: barrel.project.publicToken };
  } catch (e) {
    return fail(e);
  }
}
