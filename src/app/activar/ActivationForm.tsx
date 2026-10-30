"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { completeActivation, previewActivation } from "@/lib/actions/owner";

type Phase =
  | { name: "loading" }
  | { name: "invalid" }
  | { name: "form"; barrelNumber: string; purpose: "activation" | "reset" }
  | { name: "done"; wineToken: string | null };

const field = {
  display: "block",
  width: "100%",
  marginTop: 8,
  padding: "8px 0 10px",
  background: "transparent",
  border: 0,
  borderBottom: "2px solid var(--cs-ink)",
  borderRadius: 0,
  fontSize: 30,
  letterSpacing: "0.4em",
  color: "var(--cs-ink)",
} as const;

export function ActivationForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    // Remove the secret from the address bar / history right away.
    window.history.replaceState(null, "", window.location.pathname);
    if (!raw) {
      void Promise.resolve().then(() => setPhase({ name: "invalid" }));
      return;
    }
    void Promise.resolve().then(() => setToken(raw));
    previewActivation(raw).then((r) => setPhase(r.valid ? { name: "form", barrelNumber: r.barrelNumber, purpose: r.purpose } : { name: "invalid" }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) return setError("El PIN debe tener exactamente 6 números.");
    if (pin !== confirm) return setError("Los PIN no coinciden.");
    setBusy(true);
    const res = await completeActivation(token, pin, confirm);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPhase({ name: "done", wineToken: res.wineToken });
    setPin("");
    setConfirm("");
    if (res.wineToken) router.push(`/wine/${res.wineToken}#regalo`);
  }

  return (
    <main className="mx-auto" style={{ maxWidth: 520, padding: "clamp(40px,10vh,96px) clamp(20px,5vw,32px)" }}>
      <div className="flex items-center gap-2.5">
        <Image src="/brand/hand-mark.png" alt="" width={24} height={24} />
        <span style={{ fontSize: 18 }}>Cinco Sentidos</span>
      </div>
      <div style={{ marginTop: 40, borderTop: "2px solid var(--cs-ink)", paddingTop: 16 }} className="cs-eyebrow">
        ACCESO DE LA BARRICA
      </div>

      {phase.name === "loading" && <p style={{ marginTop: 28, color: "var(--cs-ink-soft)" }}>Verificando tu enlace…</p>}

      {phase.name === "invalid" && (
        <>
          <h1 className="font-normal" style={{ margin: "24px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.025em" }}>
            Este enlace ya no sirve.
          </h1>
          <p style={{ marginTop: 16, fontSize: 18, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
            Puede haber vencido, ya haberse usado o haber sido reemplazado por uno nuevo. Pedile a la bodega que te genere otro.
          </p>
        </>
      )}

      {phase.name === "form" && (
        <form onSubmit={submit}>
          <h1 className="font-normal" style={{ margin: "24px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.025em" }}>
            {phase.purpose === "reset" ? "Elegí el PIN nuevo" : "Elegí el PIN"} de la barrica {phase.barrelNumber}.
          </h1>
          <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
            Es un PIN de 6 números compartido por todos los dueños de esta barrica: con él se edita la historia y se dedican botellas desde su página. Compartilo solo con ellos; la bodega no puede verlo.
          </p>
          <label className="block" style={{ marginTop: 32 }}>
            <span className="cs-eyebrow">PIN</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} aria-label="PIN" style={field} />
          </label>
          <label className="block" style={{ marginTop: 24 }}>
            <span className="cs-eyebrow">REPETÍ EL PIN</span>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} aria-label="Repetir PIN" style={field} />
          </label>
          {error && (
            <p role="alert" className="cs-sans" style={{ marginTop: 14, fontSize: 13, color: "var(--cs-wine)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="cs-sans inline-flex items-center justify-between gap-4 disabled:opacity-60"
            style={{ marginTop: 32, minWidth: 240, background: "var(--cs-ink)", color: "var(--cs-paper)", padding: "15px 20px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" }}
          >
            {busy ? "GUARDANDO…" : "GUARDAR PIN"} <span style={{ fontSize: 14 }}>→</span>
          </button>
        </form>
      )}

      {phase.name === "done" && (
        <>
          <h1 className="font-normal" style={{ margin: "24px 0 0", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.025em" }}>
            Listo. Tu PIN está configurado.
          </h1>
          <p style={{ marginTop: 16, fontSize: 18, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
            {phase.wineToken ? "Te llevamos a tu barrica…" : "Ya podés volver a la página de tu barrica con la etiqueta NFC."}
          </p>
        </>
      )}
    </main>
  );
}
