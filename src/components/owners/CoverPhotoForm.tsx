"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CoverState } from "@/lib/actions/barrel-cover";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const initial: CoverState = {};

/** Cover-photo control for one barrel: preview before saving, validate, replace or remove. */
export function CoverPhotoForm({
  saveAction,
  removeAction,
  currentUrl,
  defaultUrl,
}: {
  saveAction: (prev: CoverState, fd: FormData) => Promise<CoverState>;
  removeAction: (prev: CoverState, fd: FormData) => Promise<CoverState>;
  currentUrl: string | null;
  defaultUrl: string;
}) {
  const [saveState, save, saving] = useActionState(saveAction, initial);
  const [removeState, remove, removing] = useActionState(removeAction, initial);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // After a successful save, drop the local preview: the saved image is now the current one.
  useEffect(() => {
    if (saveState.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      if (input.current) input.current.value = "";
    }
  }, [saveState]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError("");
    const f = e.target.files?.[0];
    if (!f) return setPreview(null);
    if (!TYPES.includes(f.type)) {
      e.target.value = "";
      setPreview(null);
      return setClientError("Formato no válido. Subí una imagen JPG, PNG o WebP.");
    }
    if (f.size > MAX_BYTES) {
      e.target.value = "";
      setPreview(null);
      return setClientError("La imagen es muy pesada: el máximo es 8 MB.");
    }
    setPreview(URL.createObjectURL(f));
  }

  const shown = preview ?? currentUrl ?? defaultUrl;
  const error = clientError || saveState.error || removeState.error;
  const notice = !error ? (removeState.notice ?? saveState.notice) : "";

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr] items-start">
      <div>
        <div className="relative aspect-[9/16] md:aspect-[4/5] overflow-hidden bg-bg-alt border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Vista previa de la portada" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <p className="text-xs text-ink-faint mt-2">
          {preview ? "Vista previa — todavía no se guardó." : currentUrl ? "Portada personalizada actual." : "Portada por defecto (sin foto personalizada)."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft max-w-prose">
          Es la primera imagen que se ve al abrir la página de esta barrica. Se recorta al centro para llenar la pantalla en escritorio y celular, así que conviene una foto horizontal de buena calidad con lo importante en el medio. JPG, PNG o WebP, hasta 8 MB.
        </p>
        <form action={save} onSubmit={() => setClientError("")} className="flex flex-col gap-3">
          <input ref={input} name="cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="text-sm" aria-label="Foto de portada" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={saving || !preview}>
              {saving ? "Guardando…" : currentUrl ? "Reemplazar foto" : "Guardar foto"}
            </Button>
          </div>
        </form>
        {currentUrl && (
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm("¿Quitar la foto de portada? La barrica vuelve a la portada por defecto.")) return e.preventDefault();
              setClientError("");
            }}
          >
            <Button type="submit" variant="danger" size="sm" disabled={removing}>
              {removing ? "Quitando…" : "Quitar foto personalizada"}
            </Button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-sev-high bg-sev-high-bg px-3 py-2">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-sev-low bg-sev-low-bg px-3 py-2">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
