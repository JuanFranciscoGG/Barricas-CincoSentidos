"use client";

import { createContext, useContext, useMemo, useState } from "react";
import Image from "next/image";

export interface LightboxPhoto {
  src: string;
  date: string;
  title: string;
}

interface LightboxCtx {
  open: (photo: LightboxPhoto) => void;
}

const Ctx = createContext<LightboxCtx | null>(null);

/** Wrap a gallery in this once; any descendant can call useLightbox().open(...). */
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<LightboxPhoto | null>(null);
  const value = useMemo(() => ({ open: setPhoto }), []);

  return (
    <Ctx.Provider value={value}>
      {children}
      {photo && (
        <div
          onClick={() => setPhoto(null)}
          className="cs-lightbox cs-fade-in flex flex-col justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full" style={{ maxHeight: "78vh", height: "78vh" }}>
            <Image src={photo.src} alt="" fill sizes="100vw" className="object-contain" />
          </div>
          <div className="px-6 py-5 max-w-[440px] mx-auto w-full">
            <div className="cs-eyebrow cs-eyebrow--dark">{photo.date}</div>
            <div className="mt-1.5 text-[19px]" style={{ color: "rgba(239,234,224,.85)" }}>
              {photo.title}
            </div>
            <div className="cs-eyebrow cs-eyebrow--dark mt-4">TOCÁ PARA CERRAR</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useLightbox() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLightbox must be used within a LightboxProvider");
  return ctx;
}
