import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

/** PINs are exactly six digits. Kept simple for a phone keypad; protected by lockouts + a salted hash. */
export const PIN_REGEX = /^\d{6}$/;

// A PIN has only 10^6 values, so the hash cost matters less than the lockout
// policy — but we still use a salted, adaptive hash (bcrypt, already in the stack).
const BCRYPT_ROUNDS = 12;

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && PIN_REGEX.test(pin);
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Compared against when an owner has no PIN (or does not exist) so the response
// time does not reveal which case applied.
export const DUMMY_PIN_HASH = bcrypt.hashSync("000000", BCRYPT_ROUNDS);

/** 256-bit single-use token, URL-safe. Only its hash is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
