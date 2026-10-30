import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { Role } from "@/lib/enums";

export interface SessionData {
  userId?: string;
  role?: Role;
  name?: string;
}

const password = process.env.SESSION_SECRET;
if (!password || password.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set in .env to at least 32 characters — see .env.example."
  );
}

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "barricas_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId) return null;
  return session;
}
