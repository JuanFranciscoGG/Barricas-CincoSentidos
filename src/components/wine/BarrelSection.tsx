"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { DiscoverCard } from "@/lib/knowledge";

export interface BarrelFact {
  key: string;
  label: string;
  value: string;
  card: DiscoverCard | null;
}

interface Step {
  kicker: string;
  tab: string;
  title: string;
  body?: string | null;
  facts?: { label: string; value: string }[];
  card?: DiscoverCard | null;
}

const nav = { width: 44, height: 44, border: "1px solid rgba(243,235,224,.45)" } as const;

export function BarrelSection({
  barrelNumber,
  facts,
  comparisonCard,
}: {
  barrelNumber: string;
  facts: BarrelFact[];
  comparisonCard: DiscoverCard | null;
}) {
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<{ eyebrow: string; card: DiscoverCard } | null>(null);

  const byKey = Object.fromEntries(facts.map((f) => [f.key, f]));
  const steps: Step[] = [
    {
      kicker: "01 · LA BARRICA",
      tab: "La barrica",
      title: byKey.type?.value && byKey.type.value !== "—" ? byKey.type.value : `Barrica ${barrelNumber}`,
      facts: facts.filter((f) => f.value !== "—").map((f) => ({ label: f.label, value: f.value }))
,
    },
  ];
  const oak = byKey.brand?.card;
  if (oak) steps.push({ kicker: "02 · LA MADERA", tab: "La madera", title: oak.title, body: oak.teaser, card: oak });
  const toast = byKey.toast?.card;
  if (toast) steps.push({ kicker: `0${steps.length + 1} · EL TUESTE`, tab: "El tueste", title: toast.title, body: toast.teaser, card: toast });
  if (comparisonCard)
    steps.push({
      kicker: `0${steps.length + 1} · DOS MADERAS`,
      tab: "Dos maderas",
      title: "Francés vs. americano",
      body: comparisonCard.teaser,
      card: comparisonCard
,
    });

  const last = steps.length - 1;
  const go = (i: number) => setStep(Math.max(0, Math.min(last, i)));

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const [touchX, setTouchX] = useState<number | null>(null);

  return (
    <>
      <section
        id="barrica"
        tabIndex={-1}
        className="relative overflow-hidden"
        style={{ height: "100svh", minHeight: 660, maxHeight: 1000, background: "var(--cs-cellar)", color: "var(--cs-cream)" }}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 50) go(step + (dx < 0 ? 1 : -1));
          setTouchX(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(step + 1);
          if (e.key === "ArrowLeft") go(step - 1);
        }}
      >
        {/* One fixed photo for every chapter: only the text animates. */}
        <Image src="/brand/barrel_portrait_horizontal.jpg" alt={`Barrica ${barrelNumber}`} fill sizes="100vw" className="object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,rgba(26,22,20,.62) 0%,rgba(26,22,20,.08) 26%,rgba(26,22,20,.42) 50%,rgba(26,22,20,.95) 100%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            left: "38%",
            top: "15%",
            fontSize: "clamp(120px,30vw,360px)",
            lineHeight: 0.8,
            letterSpacing: "-0.05em",
            color: "transparent",
            WebkitTextStroke: "1px rgba(243,235,224,.3)",
            whiteSpace: "nowrap",
            transform: `translateX(${-step * 4}%)`,
            transition: "transform 1.2s cubic-bezier(.22,.8,.3,1)",
          }}
        >
          {barrelNumber}
        </div>

        <div className="absolute flex justify-between items-center gap-4" style={{ top: 70, left: "clamp(20px,5vw,56px)", right: "clamp(20px,5vw,56px)" }}>
          <span className="cs-eyebrow" style={{ fontSize: 11, color: "inherit" }}>MI BARRICA · {barrelNumber}</span>
          <div className="flex items-center gap-1">
            <span className="cs-sans mr-2" style={{ fontSize: 11, letterSpacing: "0.14em", fontVariantNumeric: "tabular-nums" }}>
              0{step + 1} / 0{steps.length}
            </span>
            <button onClick={() => go(step - 1)} aria-label="Anterior" disabled={step === 0} className="flex items-center justify-center disabled:opacity-40" style={nav}>
              <svg width="18" height="12" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 7H2M7.5 1.5L2 7l5.5 5.5" /></svg>
            </button>
            <button onClick={() => go(step + 1)} aria-label="Siguiente" disabled={step === last} className="flex items-center justify-center disabled:opacity-40" style={nav}>
              <svg width="18" height="12" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 7h19M14.5 1.5L20 7l-5.5 5.5" /></svg>
            </button>
          </div>
        </div>

        <div className="absolute" style={{ left: "clamp(20px,5vw,56px)", right: "clamp(20px,5vw,56px)", bottom: 128 }}>
          <div className="relative" style={{ maxWidth: 560, minHeight: 330 }}>
            {steps.map((p, i) => {
              const on = i === step;
              return (
                <div
                  key={p.kicker}
                  className="absolute left-0 right-0 bottom-0"
                  style={{
                    opacity: on ? 1 : 0,
                    pointerEvents: on ? "auto" : "none",
                    transform: on ? "none" : `translate3d(${i < step ? -56 : 56}px,0,0)`,
                    transition: "opacity .55s ease, transform .8s cubic-bezier(.22,.8,.3,1)",
                  }}
                  aria-hidden={!on}
                >
                  <div className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--cs-brass-2)" }}>{p.kicker}</div>
                  <h2 className="m-0 font-normal" style={{ marginTop: 14, fontSize: "clamp(40px,8vw,72px)", lineHeight: 0.98, letterSpacing: "-0.025em", textWrap: "balance" }}>
                    {p.title}
                  </h2>
                  {p.body && (
                    <p style={{ margin: "18px 0 0", fontSize: 19, lineHeight: 1.55, color: "rgba(243,235,224,.92)", textWrap: "pretty" }}>{p.body}</p>
                  )}
                  {p.facts && p.facts.length > 0 && (
                    <div className="grid" style={{ marginTop: 22, gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", borderTop: "2px solid rgba(243,235,224,.75)" }}>
                      {p.facts.map((f) => (
                        <div key={f.label} style={{ padding: "12px 10px 0 0" }}>
                          <div className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.18em", color: "rgba(243,235,224,.72)" }}>{f.label}</div>
                          <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.25 }}>{f.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {p.card && (
                    <button
                      onClick={() => setSheet({ eyebrow: `${p.tab.toUpperCase()} — DESCUBRIR`, card: p.card! })}
                      className="cs-sans inline-flex items-center gap-3.5 active:scale-[.97]"
                      style={{ marginTop: 24, background: "var(--cs-cream)", color: "var(--cs-ink)", padding: "13px 18px", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em" }}
                    >
                      DESCUBRÍ MÁS <span style={{ fontSize: 14 }}>+</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute left-0 right-0 bottom-0" style={{ padding: "0 clamp(20px,5vw,56px) 14px" }}>
          <div role="tablist" aria-label="Capítulos de tu barrica" className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length},minmax(0,1fr))`, borderTop: "1px solid rgba(243,235,224,.3)" }}>
            <div
              className="absolute"
              style={{ top: -2, left: `${(step / steps.length) * 100}%`, width: `${100 / steps.length}%`, height: 3, background: "var(--cs-cream)", transition: "left .6s cubic-bezier(.22,.8,.3,1)" }}
            />
            {steps.map((s, i) => (
              <button
                key={s.tab}
                role="tab"
                aria-selected={i === step}
                onClick={() => go(i)}
                className="text-left flex flex-col"
                style={{ gap: 6, padding: "14px 8px 10px 0", minHeight: 72, opacity: i === step ? 1 : 0.55, transition: "opacity .4s ease" }}
              >
                <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.14em" }}>0{i + 1}</span>
                <span style={{ fontSize: "clamp(15px,2.2vw,21px)", lineHeight: 1.15 }}>{s.tab}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div
        onClick={() => setSheet(null)}
        className="fixed inset-0"
        style={{ zIndex: 95, background: "rgba(20,16,14,.55)", opacity: sheet ? 1 : 0, pointerEvents: sheet ? "auto" : "none", transition: "opacity .4s ease" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!sheet}
        className="fixed left-0 right-0 bottom-0 overflow-auto"
        style={{
          zIndex: 96,
          maxHeight: "86vh",
          background: "var(--cs-paper)",
          color: "var(--cs-ink)",
          borderTop: "2px solid var(--cs-ink)",
          transform: sheet ? "none" : "translateY(105%)",
          transition: "transform .6s cubic-bezier(.22,.8,.3,1)",
        }}
      >
        {sheet && (
          <div className="mx-auto" style={{ maxWidth: 760, padding: "22px clamp(20px,5vw,40px) 48px" }}>
            <div className="flex justify-between items-center gap-4">
              <span className="cs-eyebrow cs-eyebrow--wine">{sheet.eyebrow}</span>
              <button onClick={() => setSheet(null)} className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.18em", padding: "10px 0 10px 10px" }}>
                CERRAR ✕
              </button>
            </div>
            <h3 className="font-normal" style={{ margin: "10px 0 0", fontSize: "clamp(34px,6vw,52px)", lineHeight: 1, letterSpacing: "-0.025em" }}>
              {sheet.card.title}
            </h3>
            {sheet.card.factChips.length > 0 && (
              <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", borderTop: "2px solid var(--cs-ink)" }}>
                {sheet.card.factChips.map((c) => (
                  <div key={c.label} style={{ padding: "14px 14px 14px 0", borderBottom: "1px solid var(--cs-line-strong)" }}>
                    <div className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--cs-ink-faint)" }}>{c.label}</div>
                    <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.35 }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ margin: "22px 0 0", fontSize: 18, lineHeight: 1.68, color: "#3e3834", textWrap: "pretty" }}>{sheet.card.narrative}</p>
          </div>
        )}
      </div>
    </>
  );
}
