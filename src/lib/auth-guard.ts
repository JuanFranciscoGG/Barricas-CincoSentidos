import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/enums";

/**
 * Gates the winery staff admin area only. Customers never authenticate —
 * they reach their barrel through its unique, unguessable public URL (see
 * src/app/wine/[token]) instead. See src/proxy.ts for the route-level gate.
 */
export async function requireStaffSession() {
  const session = await getSession();
  if (!session.userId || !session.role) redirect("/login");
  if (!isStaff(session.role)) redirect("/login");
  return session as Required<Pick<typeof session, "userId" | "role" | "name">> & typeof session;
}

/** Owner management (PINs, activation, gifting history) is restricted to Dirección. */
export async function requireAdminSession() {
  const session = await requireStaffSession();
  if (session.role !== "owner_admin") redirect("/dashboard");
  return session;
}
