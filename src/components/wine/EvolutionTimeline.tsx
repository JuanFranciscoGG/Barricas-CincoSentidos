"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "@/components/wine/Reveal";

export interface EvolutionEntry {
  id: string;
  date: Date;
  title: string;
  note?: string | null;
  completed: boolean;
  isNow?: boolean;
  isBottling?: boolean;
  bottleCount?: number | null;
  litersObtained?: number | null;
}

const DAY_MS = 86_400_000;
const STAVE_H = 600;
const OUTLINE = "M16 0 Q9 300 16 600 L84 600 Q91 300 84 0 Z";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Static oak-grain strokes for the stave, same construction as the design.
const GRAIN: string[] = Array.from({ length: 11 }, (_, i) => {
  const x0 = 19 + i * 6.2;
  let d = `M${x0} 0`;
  for (let yy = 20; yy <= STAVE_H; yy += 20) {
    d += ` L${(x0 + Math.sin(yy / (38 + i * 3) + i * 1.7) * (1.4 + (i % 3) * 0.6)).toFixed(2)} ${yy}`;
  }
  return d;
});

export function EvolutionTimeline({
  entries,
  startDate,
  daysAging,
  estimatedDays,
  oakLabel,
}: {
  entries: EvolutionEntry[];
  startDate: Date | null;
  daysAging: number;
  estimatedDays: number | null;
  oakLabel: string | null;
}) {
  const tlRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const staveFillRef = useRef<SVGRectElement>(null);
  const staveDayRef = useRef<HTMLDivElement>(null);
  const staveSvgRef = useRef<SVGSVGElement>(null);

  // Stave is scaled to the estimated aging period (or the elapsed days if none was set).
  const span = Math.max(1, estimatedDays ?? Math.max(daysAging, 1));
  const dayOf = (d: Date) => (startDate ? Math.round((d.getTime() - startDate.getTime()) / DAY_MS) : 0);
  const yOf = (day: number) => clamp((day / span) * STAVE_H, 0, STAVE_H);
  const todayY = yOf(daysAging);

  // Scroll-linked progress: the red line grows with the reader, and the stave
  // fills to the matching day of the barrel's real aging.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const tl = tlRef.current;
      if (!tl) return;
      const vh = window.innerHeight;
      const r = tl.getBoundingClientRect();
      const f = reduce ? 1 : clamp((vh * 0.62 - r.top) / r.height, 0, 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${f})`;
      const elapsed = f * daysAging;
      if (staveFillRef.current) staveFillRef.current.setAttribute("height", String(clamp((elapsed / span) * STAVE_H, 0, STAVE_H)));
      if (staveDayRef.current) staveDayRef.current.textContent = `DÍA ${Math.round(elapsed)}`;
      staveSvgRef.current?.querySelectorAll("[data-day]").forEach((m) => {
        const on = Number(m.getAttribute("data-day")) <= elapsed + 0.5;
        m.setAttribute("fill", on ? "#F3EBE0" : "#2B2725");
        m.setAttribute("r", on ? "4.2" : "3");
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [daysAging, span]);

  return (
    <section id="evolucion" className="cs-wrap" style={{ paddingTop: "clamp(64px,10vw,120px)", paddingBottom: "clamp(48px,7vw,80px)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: "clamp(32px,6vw,88px)" }}>
        <div>
          <div className="cs-eyebrow pb-3" style={{ fontSize: 11, color: "var(--cs-ink)", borderBottom: "2px solid var(--cs-ink)" }}>EVOLUCIÓN</div>
          <h2 className="font-normal" style={{ margin: "26px 0 0", fontSize: "clamp(40px,7vw,64px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
            Lo que pasó<br />con tu vino.
          </h2>
        </div>

        <div className="grid items-start" style={{ gridTemplateColumns: "minmax(0,1fr) clamp(64px,12vw,150px)", gap: "clamp(14px,3vw,40px)" }}>
          <div ref={tlRef} className="relative">
            <div className="absolute" style={{ left: 6, top: 8, bottom: 8, width: 1, background: "rgba(43,39,37,.18)" }} />
            <div
              ref={fillRef}
              className="absolute will-change-transform"
              style={{ left: 5, top: 8, bottom: 8, width: 3, background: "var(--cs-wine)", transformOrigin: "top", transform: "scaleY(0)" }}
            />
            {entries.map((ev) => {
              const future = !ev.completed;
              return (
                <Reveal key={ev.id} className="relative" style={{ paddingLeft: 40, paddingBottom: 38 }}>
                  <div
                    className="absolute rounded-full"
                    style={{
                      top: 5,
                      left: ev.isNow ? 0 : 2,
                      width: ev.isNow ? 15 : 11,
                      height: ev.isNow ? 15 : 11,
                      background: future ? "var(--cs-paper)" : ev.isNow ? "var(--cs-wine)" : "var(--cs-ink)",
                      border: future ? "2px solid var(--cs-ink-faint)" : "0",
                    }}
                  />
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.12em", color: future ? "var(--cs-ink-faint)" : "var(--cs-ink-soft)" }}>
                      {ev.date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}
                    </span>
                    {ev.isNow && (
                      <span className="cs-sans inline-flex items-center gap-1.5" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.16em", color: "var(--cs-wine)", border: "1px solid var(--cs-wine)", padding: "2px 6px" }}>
                        <span className="w-[5px] h-[5px] rounded-full cs-breathe" style={{ background: "var(--cs-wine)" }} />
                        AQUÍ ESTÁ HOY
                      </span>
                    )}
                    {future && (
                      <span className="cs-sans" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.16em", color: "var(--cs-cream)", background: "var(--cs-ink-soft)", padding: "3px 7px" }}>
                        PRÓXIMAMENTE
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: ev.isNow ? "clamp(28px,4vw,36px)" : 24, lineHeight: 1.15, color: future ? "var(--cs-ink-soft)" : "var(--cs-ink)" }}>
                    {ev.title}
                  </div>
                  {ev.note && (
                    <p style={{ margin: "8px 0 0", fontSize: 17, lineHeight: 1.55, color: "var(--cs-ink-soft)", maxWidth: "32em", textWrap: "pretty" }}>{ev.note}</p>
                  )}
                  {ev.isBottling && (
                    <div className="mt-3.5 p-4" style={{ border: "1px solid var(--cs-line-strong)", background: "var(--cs-paper-2)" }}>
                      <div className="cs-eyebrow">EMBOTELLADO {future ? "· PREVISTO" : ""}</div>
                      <div className="mt-3 grid grid-cols-2 gap-x-2.5 gap-y-3">
                        <div>
                          <div style={{ fontSize: 25, lineHeight: 1 }}>{ev.bottleCount ?? "—"}</div>
                          <div className="cs-eyebrow mt-1">BOTELLAS</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 25, lineHeight: 1 }}>{ev.litersObtained ? `${ev.litersObtained} L` : "—"}</div>
                          <div className="cs-eyebrow mt-1">VOLUMEN</div>
                        </div>
                      </div>
                    </div>
                  )}
                </Reveal>
              );
            })}
            <div className="relative" style={{ paddingLeft: 40, paddingBottom: 4 }}>
              <div className="italic" style={{ fontSize: 15, color: "var(--cs-ink-faint)" }}>La bodega irá sumando lo que venga.</div>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="flex flex-col items-center"
            style={{ position: "sticky", top: 84, height: "min(68vh,560px)", gap: 10 }}
          >
            <div ref={staveDayRef} className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--cs-wine)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              DÍA 0
            </div>
            <div style={{ flex: 1, width: "100%", minHeight: 0 }}>
              <svg ref={staveSvgRef} viewBox="-4 -8 108 616" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
                <defs>
                  <clipPath id="csStave"><path d={OUTLINE} /></clipPath>
                </defs>
                <path d={OUTLINE} fill="#E6DBC4" />
                <g clipPath="url(#csStave)">
                  <rect ref={staveFillRef} x="0" y="0" width="100" height="0" fill="#7A2430" fillOpacity="0.9" />
                  {GRAIN.map((d, i) => (
                    <path key={i} d={d} fill="none" stroke="#2B2725" strokeOpacity={0.16 + (i % 2) * 0.06} strokeWidth="0.7" />
                  ))}
                  <ellipse cx="41" cy="214" rx="3.4" ry="9" fill="none" stroke="#2B2725" strokeOpacity="0.22" strokeWidth="0.7" />
                  <ellipse cx="63" cy="452" rx="2.6" ry="7" fill="none" stroke="#2B2725" strokeOpacity="0.2" strokeWidth="0.7" />
                  <line x1="0" x2="100" y1={todayY} y2={todayY} stroke="#7A2430" strokeWidth="1" strokeDasharray="3 2" />
                </g>
                {entries.map((e) => {
                  const day = dayOf(e.date);
                  const y = yOf(day);
                  return (
                    <g key={e.id}>
                      <line x1="16" x2="84" y1={y} y2={y} stroke={e.completed ? "#F3EBE0" : "#2B2725"} strokeOpacity={e.completed ? 0.55 : 0.35} strokeWidth="0.8" strokeDasharray={e.completed ? undefined : "2 2"} />
                      <circle data-day={day} cx="50" cy={y} r="3" fill="#2B2725" stroke="#7A2430" strokeWidth="1.2" style={{ transition: "r .4s ease, fill .4s ease" }} />
                    </g>
                  );
                })}
                <path d={OUTLINE} fill="none" stroke="#2B2725" strokeWidth="1.2" />
                <text x="50" y={STAVE_H + 20} textAnchor="middle" fill="#6F665B" style={{ font: "500 11px var(--font-archivo), sans-serif", letterSpacing: ".1em" }}>
                  {estimatedDays ? `${Math.round(estimatedDays / 30)} M` : ""}
                </text>
              </svg>
            </div>
            {oakLabel && (
              <div className="cs-sans text-center" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--cs-ink-faint)", lineHeight: 1.5 }}>
                {oakLabel.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
