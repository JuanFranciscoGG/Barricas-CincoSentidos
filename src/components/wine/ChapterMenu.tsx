"use client";

import { useState } from "react";

export interface Chapter {
  id: string;
  num: string;
  title: string;
  meta?: string;
}

/** Floating pill button + full-screen dark index, replacing a sticky tab bar. */
export function ChapterMenu({ chapters }: { chapters: Chapter[] }) {
  const [open, setOpen] = useState(false);

  function go(id: string) {
    setOpen(false);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 54, behavior: "smooth" });
    }, 60);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="cs-index-btn" aria-label="Abrir índice de secciones">
        <span className="flex flex-col gap-[2.5px]">
          <span className="w-3.5 h-[1.6px]" style={{ background: "currentColor" }} />
          <span className="w-3.5 h-[1.6px]" style={{ background: "currentColor" }} />
          <span className="w-2.5 h-[1.6px]" style={{ background: "var(--cs-wine)" }} />
        </span>
        <span className="cs-eyebrow" style={{ color: "inherit" }}>
          ÍNDICE
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col cs-fade-in"
          style={{ background: "var(--cs-cellar)", color: "var(--cs-cream)" }}
        >
          <div
            className="flex-none flex items-center justify-between"
            style={{ padding: "18px 22px", borderBottom: "1px solid rgba(239,234,224,.18)" }}
          >
            <span className="cs-eyebrow cs-eyebrow--dark">CINCO SENTIDOS</span>
            <button onClick={() => setOpen(false)} className="cs-eyebrow" style={{ color: "rgba(239,234,224,.75)" }}>
              CERRAR
            </button>
          </div>
          <div className="flex-1 flex flex-col justify-center max-w-[640px] w-full mx-auto" style={{ padding: "0 22px" }}>
            {chapters.map((c) => (
              <button
                key={c.id}
                onClick={() => go(c.id)}
                className="text-left flex items-baseline gap-4"
                style={{ padding: "15px 0", borderBottom: "1px solid rgba(239,234,224,.12)" }}
              >
                <span className="cs-eyebrow cs-eyebrow--dark w-5 flex-none">{c.num}</span>
                <span className="flex-1 font-light text-[32px] leading-[1.1]" style={{ color: "var(--cs-cream)" }}>
                  {c.title}
                </span>
                {c.meta && (
                  <span className="italic text-sm" style={{ color: "rgba(239,234,224,.4)" }}>
                    {c.meta}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div
            className="flex-none max-w-[640px] w-full mx-auto italic"
            style={{ padding: "20px 22px 30px", fontSize: 15, color: "rgba(239,234,224,.4)" }}
          >
            Tu barrica sigue madurando mientras tanto.
          </div>
        </div>
      )}
    </>
  );
}
