import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { authorizeBarrel, SESSION_IDLE_MS, SESSION_MAX_MS, type AssignmentPermission } from "@/lib/owners/service";

/**
 * Private barrel session — a separate cookie from the staff session so this
 * access can never be mistaken for (or escalated into) staff access.
 *
 * Sessions are scoped to a barrel: the cookie keeps one entry PER barrel id,
 * so entering the PIN of barrel A never authorizes anything on barrel B. Each
 * entry only says "this browser proved the PIN of that barrel at session
 * version N"; every protected action re-checks that against the database
 * (authorizeBarrel), so a PIN reset, permission change, removal of an owner or
 * revocation takes effect immediately.
 *
 * It does NOT say which person is using it — the PIN is shared.
 */
interface BarrelEntry {
  v: number;
  issuedAt: number;
  lastActive: number;
}
export interface OwnerSessionData {
  barrels?: Record<string, BarrelEntry>;
}

const MAX_BARRELS = 12; // keeps the cookie small

const password = process.env.SESSION_SECRET;
if (!password || password.length < 32) {
  throw new Error("SESSION_SECRET must be set in .env to at least 32 characters — see .env.example.");
}

const options: SessionOptions = {
  password,
  cookieName: "barricas_owner",
  ttl: Math.floor(SESSION_MAX_MS / 1000),
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Browser-session cookie (no Max-Age): closing the browser ends the private access, so a
    // fresh NFC tap later asks for the PIN again. idle/absolute expiry is
    // enforced server-side from issuedAt/lastActive (SESSION_IDLE_MS / SESSION_MAX_MS).
    maxAge: undefined,
  },
};

export async function getOwnerSession() {
  return getIronSession<OwnerSessionData>(await cookies(), options);
}

export async function startBarrelSession(barrelId: string, sessionVersion: number) {
  const session = await getOwnerSession();
  const now = Date.now();
  const barrels = { ...(session.barrels ?? {}) };
  barrels[barrelId] = { v: sessionVersion, issuedAt: now, lastActive: now };
  // Drop the oldest entries if the list ever grows.
  const keys = Object.keys(barrels).sort((a, b) => barrels[b].lastActive - barrels[a].lastActive);
  for (const k of keys.slice(MAX_BARRELS)) delete barrels[k];
  session.barrels = barrels;
  await session.save();
}

export async function endBarrelSession(barrelId: string) {
  const session = await getOwnerSession();
  if (session.barrels?.[barrelId]) {
    const barrels = { ...session.barrels };
    delete barrels[barrelId];
    session.barrels = barrels;
    await session.save();
  }
}

/**
 * Resolve barrel-level access, or null. Enforces idle and absolute expiry,
 * then the database-side authorization. `touch` slides the idle window (only
 * possible where cookies are writable, i.e. server actions).
 */
export async function getBarrelAccess(barrelId: string, permission?: AssignmentPermission, touch = false) {
  const session = await getOwnerSession();
  const entry = session.barrels?.[barrelId];
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.issuedAt > SESSION_MAX_MS || now - entry.lastActive > SESSION_IDLE_MS) return null;
  const auth = await authorizeBarrel(barrelId, entry.v, permission);
  if (!auth) return null;
  if (touch) {
    session.barrels = { ...session.barrels, [barrelId]: { ...entry, lastActive: now } };
    await session.save();
  }
  return { ...auth, sessionVersion: entry.v };
}
