"use client";

import { useEffect, useRef, useState } from "react";
import type { WineLayer } from "@/lib/knowledge";

const RG = [
  { r: 22, w: 44 },
  { r: 66, w: 26 },
  { r: 102, w: 26 },
  { r: 138, w: 26 },
  { r: 174, w: 26 },
];
const ease = "cubic-bezier(.22,.8,.3,1)";

/** "Tu vino, explicado": concentric rings draw in on scroll; tapping a ring or row opens that layer. */
export function ExplainedRings({ layers, agingPct }: { layers: WineLayer[]; agingPct: number | null }) {
  const rootRef = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [layer, setLayer] = useState(0);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const check = () => {
      if (reduce || el.getBoundingClientRect().top < window.innerHeight * 0.55) {
        setDrawn(true);
        window.removeEventListener("scroll", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  const n = layers.length;
  return (
    <section id="explicado" ref={rootRef} style={{ background: "var(--cs-wine)", color: "var(--cs-cream)", overflow: "hidden" }}>
      <div className="cs-wrap" style={{ paddingTop: "clamp(64px,10vw,120px)", paddingBottom: "clamp(64px,10vw,120px)" }}>
        <div className="flex justify-between items-baseline gap-4 pb-3" style={{ borderBottom: "2px solid var(--cs-cream)" }}>
          <span className="cs-eyebrow" style={{ fontSize: 11, color: "inherit" }}>TU VINO, EXPLICADO</span>
          <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.14em", color: "rgba(243,235,224,.8)" }}>{n} CAPAS</span>
        </div>
        <div className="grid items-center" style={{ marginTop: "clamp(36px,6vw,64px)", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: "clamp(36px,6vw,80px)" }}>
          <div className="relative w-full" style={{ maxWidth: 500, aspectRatio: "1", justifySelf: "center" }}>
            <svg viewBox="0 0 400 400" width="100%" height="100%" style={{ display: "block", transform: "rotate(-90deg)", overflow: "visible" }}>
              <circle cx="200" cy="200" r="174" fill="none" stroke="#F3EBE0" strokeOpacity=".08" strokeWidth="26" />
              {layers.map((l, i) => {
                const { r, w } = RG[i];
                const c = 2 * Math.PI * r;
                const len = l.axis === "LA CRIANZA" && agingPct !== null ? (c * agingPct) / 100 : c;
                return (
                  <circle
                    key={l.axis}
                    cx="200"
                    cy="200"
                    r={r}
                    fill="none"
                    strokeWidth={w}
                    onClick={() => setLayer(i)}
                    style={{
                      cursor: "pointer",
                      stroke: i === layer ? "#F3EBE0" : "rgba(243,235,224,.26)",
                      strokeDasharray: `${len} ${c}`,
                      strokeDashoffset: drawn ? 0 : len,
                      transition: `stroke-dashoffset 1.6s ${ease} ${i * 150}ms, stroke .45s ease`,
                    }}
                  />
                );
              })}
            </svg>
          </div>
          <div>
            {layers.map((l, i) => {
              const on = i === layer;
              return (
                <div key={l.axis} style={{ borderTop: "1px solid rgba(243,235,224,.3)", opacity: on ? 1 : 0.45, transition: "opacity .45s ease" }}>
                  <button
                    onClick={() => setLayer(i)}
                    aria-expanded={on}
                    className="w-full text-left grid items-baseline hover:opacity-100"
                    style={{ padding: "16px 0 14px", gridTemplateColumns: "34px minmax(0,1fr)", gap: 12 }}
                  >
                    <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.14em" }}>0{i + 1}</span>
                    <span className="flex flex-col min-w-0" style={{ gap: 4 }}>
                      <span className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.2em" }}>{l.axis}</span>
                      <span style={{ fontSize: "clamp(30px,4.6vw,46px)", lineHeight: 1, letterSpacing: "-0.02em" }}>{l.value}</span>
                    </span>
                  </button>
                  <div className="grid" style={{ gridTemplateRows: on ? "1fr" : "0fr", transition: `grid-template-rows .6s ${ease}` }}>
                    <div className="overflow-hidden">
                      <p style={{ margin: "0 0 20px 46px", fontSize: "clamp(18px,2.2vw,21px)", lineHeight: 1.55, textWrap: "pretty" }}>{l.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: "2px solid var(--cs-cream)" }}>
              <button
                onClick={() => setAll(!all)}
                className="cs-sans w-full flex items-center justify-between gap-4 text-left hover:opacity-80"
                style={{ padding: "16px 0", fontSize: 11, fontWeight: 500, letterSpacing: "0.2em" }}
              >
                <span>LEER TODO JUNTO</span>
                <span style={{ fontSize: 20, transform: all ? "rotate(45deg)" : "none", transition: `transform .45s ${ease}` }}>+</span>
              </button>
              <div className="grid" style={{ gridTemplateRows: all ? "1fr" : "0fr", transition: `grid-template-rows .6s ${ease}` }}>
                <div className="overflow-hidden">
                  <p style={{ margin: "0 0 8px", fontSize: 18, lineHeight: 1.65, color: "rgba(243,235,224,.92)" }}>{layers.map((l) => l.text).join(" ")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
