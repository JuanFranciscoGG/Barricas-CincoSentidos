"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guard";
import { appUrl } from "@/lib/url";
import {
  assignOwner,
  createOwner,
  issueBarrelToken,
  OwnerError,
  revokeAssignment,
  revokeBarrelSessions,
  setAccessRevoked,
  setAllocation,
  setOwnerStatus,
  updateAssignmentPermissions,
  updateOwnerContact,
  type Actor,
} from "@/lib/owners/service";

/**
 * Winery-side ownership management. Every action requires the Dirección role
 * (requireAdminSession) and is audit-logged. Nothing here can read a PIN —
 * only a bcrypt verifier exists — and PIN setup links are returned once, to
 * the admin's screen, and never stored in plaintext.
 */

async function actor(): Promise<Actor> {
  const s = await requireAdminSession();
  return { type: "staff", id: s.userId, name: s.name };
}

function message(e: unknown) {
  if (e instanceof OwnerError) return e.message;
  console.error("owner admin action failed", e instanceof Error ? e.message : "unknown error");
  return "No se pudo completar la acción.";
}

function refresh() {
  revalidatePath("/dashboard/owners", "layout");
  revalidatePath("/dashboard/barrels", "layout");
}

export interface AdminState {
  ok?: boolean;
  error?: string;
  notice?: string;
  /** Present only immediately after issuing a link; shown once, never persisted. */
  activationUrl?: string;
  expiresAt?: string;
  purpose?: "activation" | "reset";
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
function intOrZero(fd: FormData, k: string) {
  const raw = str(fd, k).trim();
  return raw === "" ? 0 : Number(raw);
}

async function run(fn: (a: Actor) => Promise<void>, notice: string): Promise<AdminState> {
  const a = await actor();
  try {
    await fn(a);
  } catch (e) {
    return { error: message(e) };
  }
  refresh();
  return { ok: true, notice };
}

// --- Owners ---------------------------------------------------------------

export async function createOwnerAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const a = await actor();
  let id: string;
  try {
    id = (await createOwner({ name: str(fd, "name"), email: str(fd, "email"), phone: str(fd, "phone") }, a)).id;
  } catch (e) {
    return { error: message(e) };
  }
  refresh();
  redirect(`/dashboard/owners/${id}`);
}

export async function updateOwnerAction(ownerId: string, _prev: AdminState, fd: FormData): Promise<AdminState> {
  return run((a) => updateOwnerContact(ownerId, { name: str(fd, "name"), email: str(fd, "email"), phone: str(fd, "phone") }, a), "Datos guardados.");
}

export async function setOwnerStatusAction(ownerId: string, status: "active" | "disabled", _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return run((a) => setOwnerStatus(ownerId, status, a), status === "disabled" ? "Dueño deshabilitado: ya no se lo puede elegir al dedicar botellas." : "Dueño restaurado.");
}

// --- Assignments & allocations -------------------------------------------

/** From a barrel's page: add an owner (optionally with an initial allocation). */
export async function addOwnerToBarrelAction(barrelId: string, _prev: AdminState, fd: FormData): Promise<AdminState> {
  const ownerId = str(fd, "ownerId");
  if (!ownerId) return { error: "Elegí un dueño." };
  return run((a) => assignOwner(ownerId, barrelId, { allocation: intOrZero(fd, "allocation") }, a).then(() => undefined), "Dueño agregado a la barrica.");
}

/** From an owner's page: add a barrel (optionally with an initial allocation). */
export async function addBarrelToOwnerAction(ownerId: string, _prev: AdminState, fd: FormData): Promise<AdminState> {
  const barrelId = str(fd, "barrelId");
  if (!barrelId) return { error: "Elegí una barrica." };
  return run((a) => assignOwner(ownerId, barrelId, { allocation: intOrZero(fd, "allocation") }, a).then(() => undefined), "Barrica asignada.");
}

export async function updateAssignmentAction(assignmentId: string, _prev: AdminState, fd: FormData): Promise<AdminState> {
  return run(async (a) => {
    const current = await prisma.barrelOwnership.findUnique({ where: { id: assignmentId } });
    if (!current || current.endedAt) throw new OwnerError("not_found", "La asignación no existe o ya terminó.");
    const canEditStory = fd.get("canEditStory") === "on";
    const canGift = fd.get("canGift") === "on";
    const allocation = intOrZero(fd, "allocation");
    if (allocation !== current.allocation) await setAllocation(assignmentId, allocation, a);
    if (canEditStory !== current.canEditStory || canGift !== current.canGift) {
      await updateAssignmentPermissions(assignmentId, { canEditStory, canGift }, a);
    }
  }, "Cambios guardados.");
}

export async function revokeAssignmentAction(assignmentId: string, _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return run((a) => revokeAssignment(assignmentId, a), "Dueño quitado de la barrica. Se cerraron las sesiones; para dejar fuera a quien ya conoce el PIN, restablecelo.");
}

// --- Shared barrel PIN & access ------------------------------------------

async function issue(barrelId: string, purpose: "activation" | "reset"): Promise<AdminState> {
  const a = await actor();
  try {
    const { token, expiresAt } = await issueBarrelToken(barrelId, purpose, a);
    refresh();
    // The token lives in the URL *fragment*: it is never sent to a server, never lands in
    // access logs and is not leaked through Referer headers.
    return { ok: true, purpose, activationUrl: `${appUrl("/activar")}#${token}`, expiresAt: expiresAt.toISOString() };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function issuePinActivationAction(barrelId: string, _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return issue(barrelId, "activation");
}

export async function issuePinResetAction(barrelId: string, _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return issue(barrelId, "reset");
}

export async function setBarrelAccessAction(barrelId: string, revoked: boolean, _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return run((a) => setAccessRevoked(barrelId, revoked, a), revoked ? "Acceso a acciones protegidas revocado." : "Acceso restaurado.");
}

export async function revokeBarrelSessionsAction(barrelId: string, _prev: AdminState, _fd: FormData): Promise<AdminState> {
  void _fd;
  return run((a) => revokeBarrelSessions(barrelId, a), "Sesiones cerradas. Todos deberán ingresar el PIN de nuevo.");
}
