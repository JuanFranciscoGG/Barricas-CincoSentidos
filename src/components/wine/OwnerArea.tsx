"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOwnerStatus,
  giftBottle,
  lockOwnerSession,
  saveOwnerStory,
  unlockWithPin,
  type OwnerPanel,
  type OwnerStatus,
} from "@/lib/actions/owner";
import { drawDedication, dedicationFileName, type DedicationData } from "@/components/wine/dedication";

export interface WineFacts {
  name: string;
  vintage: string;
  origin: string;
  barrel: string;
  oak: string;
}

type Modal = null | "pin" | "gift" | "story";
type Pending = null | "gift" | "story";

const label = { fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-ink-faint)" } as const;
const btnDark = {
  background: "var(--cs-ink)",
  color: "var(--cs-paper)",
  padding: "15px 20px",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.18em",
} as const;
const btnLight = { background: "var(--cs-cream)", color: "var(--cs-ink)", padding: "14px 18px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" } as const;

/**
 * The "Regalar" band plus the private owner tools. Public visitors only ever
 * see a neutral invitation to sign in; owner data is fetched through server
 * actions that return nothing unless a valid owner session exists, and every
 * save/gift is re-authorized on the server.
 */
export function OwnerArea({ token, wine }: { token: string; wine: WineFacts }) {
  const router = useRouter();
  const [status, setStatus] = useState<OwnerStatus | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [pending, setPending] = useState<Pending>(null);

  const refresh = useCallback(async () => {
    const s = await getOwnerStatus(token);
    setStatus(s);
    return s;
  }, [token]);

  useEffect(() => {
    // Initial status fetch is an external-system sync (server action).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const owner: OwnerPanel | null = status && status.authenticated ? status : null;

  /** Run a protected action; ask for the PIN first if there is no valid session, then continue where they were. */
  function requireOwner(action: Exclude<Pending, null>) {
    if (owner) setModal(action);
    else {
      setPending(action);
      setModal("pin");
    }
  }

  async function onUnlocked() {
    const s = await refresh();
    const next = pending;
    setPending(null);
    setModal(s.authenticated && next ? next : null);
  }

  async function lock() {
    await lockOwnerSession(token);
    router.refresh(); // the page is private: back to the PIN screen
  }

  function sessionExpired() {
    // A protected call came back "needs PIN": drop the stale state and re-prompt for the same action.
    setPending(modal === "gift" || modal === "story" ? modal : null);
    setModal("pin");
    void refresh();
    router.refresh(); // session gone: the server will render the PIN screen
  }

  return (
    <section id="regalo" style={{ background: "var(--cs-wine)", color: "var(--cs-cream)", padding: "clamp(56px,9vw,112px) clamp(20px,5vw,56px)" }}>
      <div className="mx-auto" style={{ maxWidth: 640 }}>
        <div className="cs-eyebrow" style={{ fontSize: 11, color: "rgba(243,235,224,.8)" }}>
          {owner ? `TU BARRICA · ${owner.barrelNumber}` : "REGALAR"}
        </div>
        <h2 className="font-normal" style={{ margin: "16px 0 0", fontSize: "clamp(36px,6vw,56px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          {owner ? "Administrá tu barrica." : "Regalar una botella"}
        </h2>

        {!owner && (
          <>
            <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.6, color: "rgba(243,235,224,.85)", maxWidth: "32em" }}>
              Hay vinos que merecen compartirse. Los dueños de esta barrica pueden dedicar una botella a alguien especial y descargar una dedicatoria digital.
            </p>
            {status && !status.authenticated && !status.ownerConfigured ? (
              <p className="cs-sans" style={{ marginTop: 24, fontSize: 12, color: "rgba(243,235,224,.7)" }}>
                El acceso de los dueños de esta barrica todavía no está activado.
              </p>
            ) : (
              <button onClick={() => requireOwner("gift")} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.97]" style={{ ...btnLight, marginTop: 28, minWidth: 260 }}>
                SOY DUEÑO — INGRESAR CON EL PIN <span style={{ fontSize: 14 }}>→</span>
              </button>
            )}
          </>
        )}

        {owner && (
          <>
            <div style={{ marginTop: 28, borderTop: "2px solid rgba(243,235,224,.75)", paddingTop: 14 }} className="grid grid-cols-2">
              <div>
                <div className="cs-sans" style={{ ...label, color: "rgba(243,235,224,.72)" }}>BOTELLAS DE LA BARRICA</div>
                <div style={{ marginTop: 6, fontSize: 40, lineHeight: 1 }}>{owner.inventory.total}</div>
              </div>
              <div>
                <div className="cs-sans" style={{ ...label, color: "rgba(243,235,224,.72)" }}>YA DEDICADAS</div>
                <div style={{ marginTop: 6, fontSize: 40, lineHeight: 1 }}>{owner.inventory.giftedTotal}</div>
              </div>
            </div>
            {owner.givers.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div className="cs-sans" style={{ ...label, color: "rgba(243,235,224,.72)" }}>DISPONIBLES POR DUEÑO</div>
                {owner.givers.map((g) => (
                  <div key={g.ownerId} className="flex justify-between gap-4" style={{ padding: "10px 0", borderBottom: "1px solid rgba(243,235,224,.2)" }}>
                    <span style={{ fontSize: 20 }}>{g.name}</span>
                    <span className="cs-sans" style={{ fontSize: 13, color: "rgba(243,235,224,.85)" }}>
                      {g.remaining} de {g.allocation}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!owner.inventory.bottled && (
              <p style={{ marginTop: 16, fontSize: 16, color: "rgba(243,235,224,.85)" }}>
                Tu vino todavía está en crianza. Cuando la bodega registre el embotellado vas a poder dedicar botellas.
              </p>
            )}
            <div className="flex flex-wrap gap-3" style={{ marginTop: 28 }}>
              {owner.canGift && (
                <button
                  onClick={() => setModal("gift")}
                  disabled={!owner.givers.some((g) => g.remaining > 0)}
                  className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.97] disabled:opacity-50"
                  style={{ ...btnLight, minWidth: 240 }}
                >
                  {owner.givers.some((g) => g.remaining > 0) ? "DEDICAR UNA BOTELLA" : "SIN BOTELLAS DISPONIBLES"} <span style={{ fontSize: 14 }}>→</span>
                </button>
              )}
              {owner.canEditStory && (
                <button onClick={() => setModal("story")} className="cs-sans inline-flex items-center gap-3 active:scale-[.97]" style={{ border: "1px solid rgba(243,235,224,.6)", padding: "14px 18px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" }}>
                  EDITAR MI HISTORIA
                </button>
              )}
            </div>

            {owner.gifts.length > 0 && (
              <div style={{ marginTop: 44 }}>
                <div className="flex justify-between items-baseline" style={{ borderBottom: "1px solid rgba(243,235,224,.35)", paddingBottom: 10 }}>
                  <span className="cs-sans" style={{ ...label, color: "rgba(243,235,224,.8)" }}>TUS DEDICATORIAS · PRIVADO</span>
                  <span className="cs-sans" style={{ ...label, color: "rgba(243,235,224,.8)" }}>{owner.gifts.length}</span>
                </div>
                {owner.gifts.map((g) => (
                  <div key={g.id} className="flex justify-between gap-4" style={{ padding: "14px 0", borderBottom: "1px solid rgba(243,235,224,.2)" }}>
                    <div className="min-w-0">
                      <div style={{ fontSize: 22, overflowWrap: "anywhere" }}>{g.recipientName}</div>
                      <div className="cs-sans" style={{ marginTop: 3, fontSize: 12, color: "rgba(243,235,224,.75)" }}>de {g.giverName}</div>
                      {g.message && <div className="italic" style={{ marginTop: 4, fontSize: 15, color: "rgba(243,235,224,.8)", overflowWrap: "anywhere" }}>“{g.message}”</div>}
                    </div>
                    <div className="cs-sans flex-none" style={{ fontSize: 12, color: "rgba(243,235,224,.75)" }}>
                      {new Date(g.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={lock} className="cs-sans underline underline-offset-4" style={{ marginTop: 32, fontSize: 12, color: "rgba(243,235,224,.75)" }}>
              Cerrar mi sesión privada
            </button>
          </>
        )}
      </div>

      {modal === "pin" && <PinDialog token={token} onClose={() => { setModal(null); setPending(null); }} onUnlocked={onUnlocked} />}
      {modal === "gift" && owner && (
        <GiftDialog
          token={token}
          owner={owner}
          wine={wine}
          onClose={() => setModal(null)}
          onChanged={() => void refresh()}
          onExpired={sessionExpired}
        />
      )}
      {modal === "story" && owner && (
        <StoryDialog
          token={token}
          initial={owner.story}
          onClose={() => setModal(null)}
          onSaved={() => {
            void refresh();
            router.refresh();
          }}
          onExpired={sessionExpired}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Sheet({ title, step, onClose, wide, children }: { title: string; step?: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 flex items-center justify-center cs-fade-in" style={{ zIndex: 80, padding: "clamp(0px,3vw,32px)", color: "var(--cs-ink)" }}>
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(31,27,25,.66)" }} />
      <div className="relative w-full overflow-y-auto" style={{ maxWidth: wide ? 920 : 560, maxHeight: "100%", background: "var(--cs-paper)" }}>
        <div className="sticky top-0 flex items-center justify-between gap-4" style={{ zIndex: 2, height: 58, padding: "0 clamp(20px,4vw,40px)", background: "var(--cs-paper)", borderBottom: "2px solid var(--cs-ink)" }}>
          <span className="cs-eyebrow" style={{ color: "var(--cs-ink)" }}>{step ?? title.toUpperCase()}</span>
          <button onClick={onClose} aria-label="Cerrar" className="flex items-center justify-center" style={{ width: 44, height: 44, marginRight: -12 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l12 12M14 2L2 14" /></svg>
          </button>
        </div>
        <div style={{ padding: "clamp(28px,5vw,48px) clamp(20px,4vw,40px) clamp(32px,5vw,48px)" }}>{children}</div>
      </div>
    </div>
  );
}

function PinDialog({ token, onClose, onUnlocked }: { token: string; onClose: () => void; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await unlockWithPin(token, pin);
    setBusy(false);
    setPin("");
    if (res.ok) return onUnlocked();
    setError(res.retryAfterSec ? `${res.error} (${Math.ceil(res.retryAfterSec / 60)} min)` : res.error);
    input.current?.focus();
  }

  return (
    <Sheet title="Ingresá tu PIN" step="ACCESO DEL DUEÑO" onClose={onClose}>
      <form onSubmit={submit}>
        <h3 className="font-normal" style={{ margin: 0, fontSize: "clamp(34px,6vw,48px)", lineHeight: 1, letterSpacing: "-0.025em" }}>Ingresá tu PIN</h3>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
          Solo el dueño de esta barrica puede editar su historia o dedicar botellas. Todo lo de esta página es privado: se ve solo con el PIN.
        </p>
        <label className="block" style={{ marginTop: 28 }}>
          <span className="cs-eyebrow">PIN DE 6 NÚMEROS</span>
          <input
            ref={input}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            aria-label="PIN"
            style={{ display: "block", width: "100%", marginTop: 8, padding: "8px 0 10px", background: "transparent", border: 0, borderBottom: "2px solid var(--cs-ink)", borderRadius: 0, fontSize: 34, letterSpacing: "0.5em", color: "var(--cs-ink)" }}
          />
        </label>
        {error && <p role="alert" className="cs-sans" style={{ marginTop: 12, fontSize: 13, color: "var(--cs-wine)" }}>{error}</p>}
        <button type="submit" disabled={busy || pin.length !== 6} className="cs-sans inline-flex items-center justify-between gap-4 disabled:opacity-50 active:scale-[.97]" style={{ ...btnDark, marginTop: 28, minWidth: 220 }}>
          {busy ? "VERIFICANDO…" : "CONTINUAR"} <span style={{ fontSize: 14 }}>→</span>
        </button>
        <p className="cs-sans" style={{ marginTop: 18, fontSize: 12, color: "var(--cs-ink-faint)" }}>
          ¿Olvidaste tu PIN? Pedile a la bodega que lo restablezca.
        </p>
      </form>
    </Sheet>
  );
}

type GiftStep = "form" | "confirm" | "done";

function GiftDialog({
  token,
  owner,
  wine,
  onClose,
  onChanged,
  onExpired,
}: {
  token: string;
  owner: OwnerPanel;
  wine: WineFacts;
  onClose: () => void;
  onChanged: () => void;
  onExpired: () => void;
}) {
  const [step, setStep] = useState<GiftStep>("form");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [nameErr, setNameErr] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [final, setFinal] = useState<{ url: string; blob: Blob; recipient: string } | null>(null);
  const [note, setNote] = useState("");
  // The shared PIN does not identify anyone, so the giver must be chosen explicitly
  // (pre-selected only when the barrel has a single eligible owner).
  const [giverId, setGiverId] = useState(owner.givers.length === 1 ? owner.givers[0].ownerId : "");
  const [giverErr, setGiverErr] = useState(false);
  const giver = owner.givers.find((g) => g.ownerId === giverId) ?? null;
  const [remainingAfter, setRemainingAfter] = useState<number | null>(null);
  // One key per dedication: a double-click or retry can never deduct twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const data = (recipient: string, msg: string, createdAt: string): DedicationData => ({
    recipient,
    message: msg,
    ownerName: giver?.name ?? "",
    wine: wine.name,
    vintage: wine.vintage,
    origin: wine.origin,
    barrel: wine.barrel,
    oak: wine.oak,
    createdAt,
  });

  async function toConfirm() {
    if (!giver) return setGiverErr(true);
    if (giver.remaining <= 0) return setGiverErr(true);
    if (!name.trim()) return setNameErr(true);
    setNameErr(false);
    setGiverErr(false);
    setStep("confirm");
    setPreview("");
    const blob = await drawDedication(data(name.trim(), message.trim(), new Date().toISOString()));
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    setPreview(url);
  }

  async function confirmGift() {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await giftBottle(token, { ownerId: giverId, recipientName: name, message, idempotencyKey });
    if (!res.ok) {
      setBusy(false);
      if ("needsPin" in res && res.needsPin) return onExpired();
      return setError(res.error);
    }
    const blob = await drawDedication(data(res.gift.recipientName, res.gift.message ?? "", res.gift.createdAt));
    const url = URL.createObjectURL(blob);
    urls.current.push(url);
    setFinal({ url, blob, recipient: res.gift.recipientName });
    setRemainingAfter(res.giverRemaining);
    setBusy(false);
    setStep("done");
    onChanged();
  }

  function download() {
    if (!final) return;
    const a = document.createElement("a");
    a.href = final.url;
    a.download = dedicationFileName(final.recipient);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!final) return;
    const text = `${final.recipient}, te dediqué una botella de ${wine.name}, de mi barrica en Cinco Sentidos.`;
    let file: File | null = null;
    try {
      file = new File([final.blob], dedicationFileName(final.recipient), { type: "image/png" });
    } catch {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return setNote("Se abrió el menú para compartir. Si elegiste WhatsApp, terminá el envío desde ahí.");
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    download();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setNote("Descargamos la dedicatoria y abrimos WhatsApp. Elegí el chat y adjuntá la imagen: WhatsApp no permite adjuntarla automáticamente desde el navegador.");
  }

  const stepLabel = step === "form" ? "01 / 03 — LA DEDICATORIA" : step === "confirm" ? "02 / 03 — CONFIRMACIÓN" : "03 / 03 — LISTA";
  const h3 = { margin: 0, fontSize: "clamp(34px,6vw,48px)", lineHeight: 1, letterSpacing: "-0.025em" } as const;
  const line = { fontFamily: "var(--font-archivo), system-ui, sans-serif" } as const;

  return (
    <Sheet title="Dedicar una botella" step={stepLabel} onClose={busy ? () => {} : onClose} wide={step === "done"}>
      {step === "form" && (
        <>
          <h3 className="font-normal" style={h3}>Dedicar una botella</h3>
          <p className="cs-sans" style={{ margin: "14px 0 0", fontSize: 13, color: "var(--cs-ink-soft)" }}>
            Es una dedicatoria digital: la entrega de la botella no se gestiona desde acá.
          </p>
          <fieldset style={{ margin: "28px 0 0", padding: 0, border: 0 }}>
            <legend className="cs-eyebrow">¿QUIÉN DEDICA LA BOTELLA?</legend>
            <div role="radiogroup" aria-label="Quién dedica la botella" style={{ marginTop: 8, borderTop: "2px solid var(--cs-ink)" }}>
              {owner.givers.map((g) => {
                const on = g.ownerId === giverId;
                const empty = g.remaining <= 0;
                return (
                  <button
                    key={g.ownerId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={empty}
                    onClick={() => { setGiverId(g.ownerId); setGiverErr(false); }}
                    className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-45"
                    style={{ padding: "14px 0", borderBottom: "1px solid var(--cs-line-strong)", background: on ? "var(--cs-paper-2)" : "transparent" }}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex-none rounded-full" style={{ width: 16, height: 16, border: "2px solid var(--cs-ink)", background: on ? "var(--cs-wine)" : "transparent", boxShadow: on ? "inset 0 0 0 2px var(--cs-paper)" : "none" }} />
                      <span style={{ fontSize: 22 }}>{g.name}</span>
                    </span>
                    <span className="cs-sans" style={{ fontSize: 12, color: "var(--cs-ink-soft)" }}>
                      {empty ? "sin botellas" : `${g.remaining} de ${g.allocation} disponibles`}
                    </span>
                  </button>
                );
              })}
            </div>
            {giverErr && (
              <p role="alert" className="cs-sans" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--cs-wine)" }}>
                {giver && giver.remaining <= 0 ? "Esa persona no tiene botellas disponibles." : "Elegí quién dedica la botella."}
              </p>
            )}
            <p className="cs-sans" style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.5, color: "var(--cs-ink-faint)" }}>
              El PIN es compartido por todos los dueños de la barrica, así que esta elección registra a quién se atribuye la dedicatoria; no verifica identidad.
            </p>
          </fieldset>
          <label className="block" style={{ marginTop: 32 }}>
            <span className="cs-eyebrow">PARA</span>
            <input value={name} onChange={(e) => { setName(e.target.value); setNameErr(false); }} maxLength={40} autoComplete="off" placeholder="Nombre de quien recibe" style={{ display: "block", width: "100%", marginTop: 8, padding: "8px 0 10px", background: "transparent", border: 0, borderBottom: "2px solid var(--cs-ink)", borderRadius: 0, fontSize: 28, color: "var(--cs-ink)" }} />
          </label>
          {nameErr && <p className="cs-sans" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--cs-wine)" }}>Escribí el nombre de quien va a recibir la botella.</p>}
          <label className="block" style={{ marginTop: 28 }}>
            <span className="flex justify-between gap-3">
              <span className="cs-eyebrow">MENSAJE · OPCIONAL</span>
              <span className="cs-eyebrow">{message.length} / 240</span>
            </span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={240} rows={4} placeholder="Para brindar por todos los momentos que todavía nos quedan por compartir." style={{ display: "block", width: "100%", marginTop: 8, padding: "14px 0", resize: "vertical", background: "transparent", border: 0, borderTop: "1px solid var(--cs-line-strong)", borderBottom: "2px solid var(--cs-ink)", borderRadius: 0, fontSize: 18, lineHeight: 1.5, color: "var(--cs-ink)" }} />
          </label>
          <div className="flex justify-end" style={{ marginTop: 32 }}>
            <button onClick={toConfirm} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.97]" style={{ ...btnDark, minWidth: 220 }}>
              VER LA DEDICATORIA <span style={{ fontSize: 14 }}>→</span>
            </button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <h3 className="font-normal" style={h3}>Revisá la dedicatoria</h3>
          <div className="relative" style={{ marginTop: 24, aspectRatio: "4/5", maxWidth: 380, background: "var(--cs-cream)", border: "1px solid var(--cs-line-strong)" }}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={`Vista previa de la dedicatoria para ${name}`} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center cs-breathe" style={{ ...line, fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-ink-faint)" }}>PREPARANDO LA VISTA PREVIA</div>
            )}
          </div>
          <div style={{ marginTop: 20, padding: "16px 18px", background: "var(--cs-cream)", border: "1px solid var(--cs-line-strong)" }}>
            <div className="cs-eyebrow cs-eyebrow--wine">QUÉ SIGNIFICA</div>
            <p style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.55, color: "#3e3834" }}>
              Se descuenta <strong>una</strong> botella de la asignación de <strong>{giver?.name}</strong> ({giver?.remaining} → {(giver?.remaining ?? 1) - 1}) y queda registrada a nombre de {name.trim()}, dedicada por {giver?.name}. Es una dedicatoria digital: no organiza envío ni retiro, y no se puede deshacer desde acá.
            </p>
          </div>
          {error && <p role="alert" className="cs-sans" style={{ margin: "14px 0 0", fontSize: 13, color: "var(--cs-wine)" }}>{error}</p>}
          <div className="flex justify-between items-center gap-4 flex-wrap" style={{ marginTop: 28 }}>
            <button onClick={() => setStep("form")} disabled={busy} className="cs-sans" style={{ padding: "15px 4px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", borderBottom: "2px solid var(--cs-ink)" }}>← VOLVER</button>
            <button onClick={confirmGift} disabled={busy} aria-busy={busy} className="cs-sans inline-flex items-center justify-between gap-4 disabled:opacity-70 active:scale-[.97]" style={{ ...btnDark, background: "var(--cs-wine)", color: "var(--cs-cream)", minWidth: 240 }}>
              {busy ? "DEDICANDO…" : "CONFIRMAR Y DEDICAR"} <span style={{ fontSize: 14 }}>→</span>
            </button>
          </div>
        </>
      )}

      {step === "done" && final && (
        <div className="grid items-start" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "clamp(28px,4vw,48px)" }}>
          <div style={{ aspectRatio: "4/5", background: "var(--cs-cream)", border: "1px solid var(--cs-line-strong)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={final.url} alt={`Dedicatoria para ${final.recipient}`} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <div className="cs-eyebrow cs-eyebrow--wine">DEDICATORIA CREADA</div>
            <h3 className="font-normal" style={{ margin: "12px 0 0", fontSize: "clamp(28px,4vw,38px)", lineHeight: 1.1, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
              La botella está dedicada a {final.recipient}.
            </h3>
            <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
              A {giver?.name} le quedan {remainingAfter ?? 0} {remainingAfter === 1 ? "botella" : "botellas"}. Descargá la dedicatoria o compartila por WhatsApp.
            </p>
            <div className="flex flex-col gap-2.5" style={{ marginTop: 24 }}>
              <button onClick={share} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.98]" style={{ ...btnDark, background: "var(--cs-wine)", color: "var(--cs-cream)" }}>COMPARTIR POR WHATSAPP <span>↗</span></button>
              <button onClick={download} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.98]" style={btnDark}>DESCARGAR IMAGEN <span>↓</span></button>
              <button onClick={onClose} className="cs-sans text-left" style={{ padding: "15px 4px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", borderBottom: "2px solid var(--cs-ink)" }}>LISTO</button>
            </div>
            {note && <p role="status" className="cs-sans" style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.6, color: "#3e3834" }}>{note}</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function StoryDialog({
  token,
  initial,
  onClose,
  onSaved,
  onExpired,
}: {
  token: string;
  initial: { text: string; visible: boolean };
  onClose: () => void;
  onSaved: () => void;
  onExpired: () => void;
}) {
  const [text, setText] = useState(initial.text);
  const [visible, setVisible] = useState(initial.visible || initial.text === "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await saveOwnerStory(token, text, visible);
    setBusy(false);
    if (!res.ok) {
      if ("needsPin" in res && res.needsPin) return onExpired();
      return setError(res.error);
    }
    setSaved(true);
    onSaved();
  }

  return (
    <Sheet title="Mi historia" step="MI HISTORIA" onClose={onClose}>
      <h3 className="font-normal" style={{ margin: 0, fontSize: "clamp(34px,6vw,48px)", lineHeight: 1, letterSpacing: "-0.025em" }}>Mi historia</h3>
      <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
        Por qué este vino existe. Es opcional, es tuyo, y vos decidís si se muestra o no.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        rows={8}
        maxLength={4000}
        placeholder="Por ejemplo: mi vino se está creando para los 18 años de mi hijo…"
        style={{ marginTop: 28, width: "100%", resize: "vertical", background: "var(--cs-paper-2)", border: 0, borderTop: "2px solid var(--cs-ink)", borderBottom: "1px solid var(--cs-line-strong)", padding: "20px 4px", fontStyle: "italic", fontSize: 22, lineHeight: 1.45, color: "var(--cs-ink)", outline: "none" }}
      />
      <button onClick={() => { setVisible(!visible); setSaved(false); }} role="switch" aria-checked={visible} className="cs-sans flex items-center gap-3.5 text-left" style={{ marginTop: 20, fontSize: 14, color: "#3e3834" }}>
        <span className="relative flex-none" style={{ width: 44, height: 24, border: "2px solid var(--cs-ink)", background: visible ? "var(--cs-wine)" : "transparent", transition: "background .3s ease" }}>
          <span className="absolute" style={{ top: 2, left: visible ? 22 : 2, width: 16, height: 16, background: visible ? "var(--cs-cream)" : "var(--cs-ink)", transition: "left .3s cubic-bezier(.22,.8,.3,1), background .3s ease" }} />
        </span>
        Mostrar esta historia en la página de mi barrica
      </button>
      {error && <p role="alert" className="cs-sans" style={{ margin: "14px 0 0", fontSize: 13, color: "var(--cs-wine)" }}>{error}</p>}
      <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: 28 }}>
        <button onClick={save} disabled={busy || text.trim() === ""} className="cs-sans inline-flex items-center gap-4 disabled:opacity-50 active:scale-[.97]" style={{ ...btnDark, background: "var(--cs-wine)", color: "var(--cs-cream)" }}>
          {busy ? "GUARDANDO…" : "GUARDAR"}
        </button>
        <span role="status" className="cs-sans" style={{ fontSize: 13, color: "#3e6b4e", opacity: saved ? 1 : 0, transition: "opacity .4s ease" }}>✓ Guardado</span>
      </div>
    </Sheet>
  );
}
