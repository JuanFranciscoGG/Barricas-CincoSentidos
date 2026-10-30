"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/wine/OwnerArea";
import { getBarrelToday } from "@/lib/actions/barrel-today";
import { drawBarrelToday, todayFileName } from "@/components/wine/barrelToday";

type Phase = "idle" | "loading" | "ready" | "error";

/**
 * "Mi barrica hoy": builds a fresh, shareable PNG of the barrel's current
 * status when asked (data read at click time, not a stored image). Uses only
 * data the public page already shows, so no PIN is needed.
 */
export function BarrelTodayButton({ token, barrelNumber, wineName }: { token: string; barrelNumber: string; wineName: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function generate() {
    setPhase("loading");
    setError("");
    setNote("");
    try {
      const res = await getBarrelToday(token);
      if (!res.ok) throw new Error(res.error);
      const blob = await drawBarrelToday(res.data, new Date());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setImage({ url, blob, name: todayFileName(res.data.barrelNumber) });
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error && e.message && !/^(canvas|blob)$/.test(e.message) ? e.message : "No pudimos generar la imagen. Probá de nuevo.");
      setPhase("error");
    }
  }

  function openAndGenerate() {
    setOpen(true);
    void generate();
  }

  function download() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = image.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function share() {
    if (!image) return;
    const text = `Así va mi barrica ${barrelNumber} hoy — ${wineName}, de Cinco Sentidos.`;
    let file: File | null = null;
    try {
      file = new File([image.blob], image.name, { type: "image/png" });
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
    setNote("Descargamos la imagen y abrimos WhatsApp. Elegí el chat y adjuntala: WhatsApp no permite adjuntarla automáticamente desde el navegador.");
  }

  const btn = { background: "var(--cs-ink)", color: "var(--cs-paper)", padding: "15px 20px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" } as const;

  return (
    <>
      <button
        onClick={openAndGenerate}
        className="cs-sans flex w-full items-center justify-between gap-4 text-left transition-opacity hover:opacity-80"
        style={{ borderTop: "2px solid var(--cs-ink)", padding: "16px 0 0", fontSize: 11, letterSpacing: "0.2em" }}
      >
        <span>MI BARRICA HOY · IMAGEN PARA COMPARTIR</span>
        <span style={{ fontSize: 15 }}>↓</span>
      </button>

      {open && (
        <Sheet title="Mi barrica hoy" step="MI BARRICA HOY" onClose={() => setOpen(false)} wide>
          <div className="grid items-start" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "clamp(28px,4vw,48px)" }}>
            <div className="relative" style={{ aspectRatio: "4/5", background: "var(--cs-cream)", border: "1px solid var(--cs-line-strong)" }}>
              {phase === "ready" && image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt={`Mi barrica ${barrelNumber} hoy`} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center cs-sans cs-breathe" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-ink-faint)", padding: 20 }}>
                  {phase === "error" ? "NO SE PUDO GENERAR" : "PREPARANDO TU IMAGEN"}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-normal" style={{ margin: 0, fontSize: "clamp(30px,4vw,40px)", lineHeight: 1.08, letterSpacing: "-0.02em" }}>
                Así está tu barrica hoy.
              </h3>
              <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--cs-ink-soft)" }}>
                Una imagen con el estado actual de tu barrica, lista para compartir con quien te pregunte cómo viene tu vino.
              </p>
              {phase === "error" && (
                <p role="alert" className="cs-sans" style={{ margin: "16px 0 0", fontSize: 13, color: "var(--cs-wine)" }}>
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2.5" style={{ marginTop: 24 }}>
                {phase === "ready" && (
                  <>
                    <button onClick={share} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.98]" style={{ ...btn, background: "var(--cs-wine)", color: "var(--cs-cream)" }}>
                      COMPARTIR POR WHATSAPP <span>↗</span>
                    </button>
                    <button onClick={download} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.98]" style={btn}>
                      DESCARGAR IMAGEN <span>↓</span>
                    </button>
                  </>
                )}
                {phase === "error" && (
                  <button onClick={generate} className="cs-sans inline-flex items-center justify-between gap-4 active:scale-[.98]" style={btn}>
                    REINTENTAR <span>→</span>
                  </button>
                )}
                {phase === "loading" && (
                  <span className="cs-sans" style={{ fontSize: 12, color: "var(--cs-ink-faint)" }}>
                    Generando con los datos de hoy…
                  </span>
                )}
              </div>
              {note && (
                <p role="status" className="cs-sans" style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.6, color: "#3e3834" }}>
                  {note}
                </p>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
