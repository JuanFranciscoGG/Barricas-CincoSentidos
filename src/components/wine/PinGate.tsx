"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { unlockWithPin } from "@/lib/actions/owner";

/**
 * The only thing a visitor sees before the barrel's PIN is verified: the
 * barrel's cover photo and a PIN field. No barrel data is rendered or sent to
 * the browser here — verification happens in a server action, and a successful
 * unlock re-renders the page on the server with the private content.
 */
export function PinGate({ token, cover, configured }: { token: string; cover: string; configured: boolean }) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || pin.length !== 6) return;
    setBusy(true);
    setError("");
    const res = await unlockWithPin(token, pin);
    setPin("");
    if (res.ok) {
      router.refresh(); // server re-renders the page, now with a valid session
      return; // keep the button busy until the new content replaces this screen
    }
    setBusy(false);
    setError(res.retryAfterSec ? `${res.error} (${Math.max(1, Math.ceil(res.retryAfterSec / 60))} min)` : res.error);
    input.current?.focus();
  }

  const rise = (delay: number) =>
    ({ opacity: entered ? 1 : 0, transform: entered ? "translateY(0)" : "translateY(18px)", transition: `opacity .9s ease ${delay}s, transform 1.1s cubic-bezier(.22,.8,.3,1) ${delay}s` }) as const;

  return (
    <main className="relative min-h-dvh overflow-hidden" style={{ background: "var(--cs-ink)", color: "#efe8da" }}>
      <Image src={cover} alt="" fill sizes="100vw" priority className="object-cover" style={{ opacity: entered ? 1 : 0, transform: entered ? "scale(1)" : "scale(1.08)", transition: "opacity 1.4s ease, transform 2.4s cubic-bezier(.22,.8,.3,1)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(26,22,20,.88), rgba(26,22,20,.5) 55%, rgba(26,22,20,.35))" }} />

      <div className="relative flex min-h-dvh flex-col justify-end" style={{ padding: "clamp(28px,6vh,64px) clamp(20px,5vw,56px) clamp(40px,10vh,90px)" }}>
        <div style={{ maxWidth: 460 }}>
          <div className="cs-sans" style={{ ...rise(0.1), fontSize: 11, letterSpacing: "0.26em", color: "var(--cs-brass-2)" }}>
            CINCO SENTIDOS · ACCESO PRIVADO
          </div>
          <h1 className="font-normal" style={{ ...rise(0.2), margin: "16px 0 0", fontSize: "clamp(44px,9vw,84px)", lineHeight: 0.95, letterSpacing: "-0.035em" }}>
            Tu barrica.
          </h1>

          {configured ? (
            <form onSubmit={submit} style={rise(0.35)}>
              <p style={{ margin: "18px 0 0", fontSize: 17, lineHeight: 1.55, color: "rgba(239,232,218,.8)" }}>Ingresá el PIN de 6 números para ver todo sobre tu barrica.</p>
              <label className="block" style={{ marginTop: 28 }}>
                <span className="cs-sans" style={{ fontSize: 10.5, letterSpacing: "0.22em", color: "rgba(239,232,218,.6)" }}>PIN</span>
                <input
                  ref={input}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  autoFocus
                  maxLength={6}
                  aria-label="PIN de 6 números"
                  aria-invalid={Boolean(error)}
                  style={{ display: "block", width: "100%", marginTop: 8, padding: "8px 0 10px", background: "transparent", border: 0, borderBottom: "2px solid rgba(239,232,218,.85)", borderRadius: 0, outline: "none", fontSize: 34, letterSpacing: "0.5em", color: "#efe8da" }}
                />
              </label>
              {error && (
                <p role="alert" className="cs-sans" style={{ marginTop: 12, fontSize: 13, color: "#f0b4ba" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy || pin.length !== 6}
                className="cs-sans inline-flex items-center justify-between gap-4 disabled:opacity-50 active:scale-[.97]"
                style={{ marginTop: 28, minWidth: 240, background: "var(--cs-cream)", color: "var(--cs-ink)", padding: "15px 20px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" }}
              >
                {busy ? "VERIFICANDO…" : "DESBLOQUEAR"} <span style={{ fontSize: 14 }}>→</span>
              </button>
              <p className="cs-sans" style={{ marginTop: 20, fontSize: 12, color: "rgba(239,232,218,.6)" }}>
                ¿Olvidaste tu PIN? Pedile a la bodega que lo restablezca.
              </p>
            </form>
          ) : (
            <p style={{ ...rise(0.35), margin: "18px 0 0", fontSize: 17, lineHeight: 1.55, color: "rgba(239,232,218,.8)" }}>
              El acceso a esta barrica todavía no está activado. Pedile a la bodega el enlace para elegir tu PIN.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
