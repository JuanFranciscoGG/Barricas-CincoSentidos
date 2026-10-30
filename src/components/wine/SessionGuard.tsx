"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { keepSessionAlive, lockOwnerSession } from "@/lib/actions/owner";

const PING_MS = 5 * 60 * 1000;

/**
 * Keeps the private session alive only while the page is actually in use
 * (visible), and drops back to the PIN screen as soon as the server says the
 * session ended — expiry, PIN reset, revoked access or another logout.
 */
export function SessionGuard({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    async function ping() {
      if (stopped || document.visibilityState !== "visible") return;
      const alive = await keepSessionAlive(token).catch(() => true); // offline: don't kick anyone out
      if (!alive && !stopped) router.refresh();
    }
    const id = window.setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [token, router]);

  async function lock() {
    await lockOwnerSession(token);
    router.refresh();
  }

  return (
    <button onClick={lock} className="cs-sans underline underline-offset-4" style={{ marginTop: 28, fontSize: 12, color: "rgba(239,234,224,.6)" }}>
      Cerrar acceso en este dispositivo
    </button>
  );
}
