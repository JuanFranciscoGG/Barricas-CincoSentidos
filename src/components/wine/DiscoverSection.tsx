"use client";

import { useState } from "react";
import { OriginMap } from "@/components/wine/OriginMap";
import type { DiscoverCard, OriginPlace } from "@/lib/knowledge";

export function DiscoverSection({
  originPlace,
  cards,
}: {
  originPlace: OriginPlace | null;
  cards: DiscoverCard[];
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <section id="descubri" className="cs-wrap" style={{ paddingTop: "clamp(64px,10vw,120px)", paddingBottom: "clamp(40px,6vw,80px)" }}>
      <div className="cs-eyebrow pb-3" style={{ fontSize: 11, color: "var(--cs-ink)", borderBottom: "2px solid var(--cs-ink)" }}>TU VINO Y SU ORIGEN</div>
      <p className="mt-5 italic max-w-[34em]" style={{ fontSize: 17, lineHeight: 1.5, color: "var(--cs-ink-soft)" }}>
        Lo esencial primero. Lo profundo, si querés abrirlo.
      </p>

      {originPlace && (
        <div>
          <OriginMap place={originPlace} />
        </div>
      )}

      <div style={{ marginTop: 48, borderTop: "2px solid var(--cs-ink)" }}>
        {cards.map((card, i) => {
          const isOpen = !!open[i];
          return (
            <div key={i} style={{ borderBottom: "1px solid var(--cs-line-strong)" }}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                aria-expanded={isOpen}
                className="w-full text-left flex items-start"
                style={{ padding: "20px 0", gap: 16 }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block cs-sans" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-wine)" }}>{card.eyebrow}</span>
                  <span className="block" style={{ marginTop: 7, fontSize: 28, lineHeight: 1.1 }}>{card.title}</span>
                  {card.locationLine && (
                    <span className="block cs-sans" style={{ marginTop: 4, fontSize: 12, color: "var(--cs-ink-soft)" }}>{card.locationLine}</span>
                  )}
                  {card.teaser && (
                    <span className="block" style={{ marginTop: 10, fontSize: 17, lineHeight: 1.5, color: "#3e3834" }}>{card.teaser}</span>
                  )}
                </span>
                <span
                  className="flex-none cs-sans"
                  style={{ marginTop: 24, fontSize: 20, color: "var(--cs-wine)", transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .45s ease" }}
                >
                  +
                </span>
              </button>
              <div className="grid" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows .6s cubic-bezier(.22,.8,.3,1)" }}>
                <div className="overflow-hidden">
                  <div style={{ paddingBottom: 24 }}>
                    {card.factChips.length > 0 && (
                      <div className="grid grid-cols-2" style={{ borderTop: "1px solid var(--cs-line-strong)" }}>
                        {card.factChips.map((chip) => (
                          <div key={chip.label} style={{ padding: "12px 12px 12px 0", borderBottom: "1px solid rgba(43,39,37,.14)" }}>
                            <div className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--cs-ink-faint)" }}>{chip.label}</div>
                            <div style={{ marginTop: 5, fontSize: 16, lineHeight: 1.35 }}>{chip.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.65, color: "#3e3834" }}>{card.narrative}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
