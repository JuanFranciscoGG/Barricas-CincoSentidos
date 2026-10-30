"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function WineHero({
  heroImage,
  variety,
  vintage,
  barrelNumber,
  customerName,
  statusLabel,
}: {
  heroImage: string;
  variety: string;
  vintage: number | null;
  barrelNumber: string | null;
  customerName: string | null;
  statusLabel: string;
}) {
  const label = { fontSize: 10, letterSpacing: "0.2em", color: "rgba(243,235,224,.72)" } as const;
  const imgRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);

  // Parallax + fade-out as the hero scrolls away; header turns solid once past it.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      setSolid(y > vh * 0.82);
      if (reduce) return;
      const k = Math.min(y / vh, 1.2);
      if (imgRef.current) imgRef.current.style.transform = `translate3d(0,${y * 0.32}px,0) scale(${1.06 - k * 0.04})`;
      if (textRef.current) {
        textRef.current.style.opacity = String(clamp(1 - y / (vh * 0.65), 0, 1));
        textRef.current.style.transform = `translate3d(0,${y * -0.12}px,0)`;
      }
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
  }, []);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[60] flex items-center gap-2.5 h-[58px]"
        style={{
          padding: "0 clamp(18px,4vw,40px)",
          background: solid ? "var(--cs-paper)" : "transparent",
          borderBottom: solid ? "2px solid var(--cs-ink)" : "2px solid transparent",
          color: solid ? "var(--cs-ink)" : "var(--cs-cream)",
          transition: "background .45s ease, color .45s ease, border-color .45s ease",
        }}
      >
        <Image src="/brand/hand-mark.png" alt="" width={24} height={24} />
        <span style={{ fontSize: 18, letterSpacing: "0.01em" }}>Cinco Sentidos</span>
      </header>

      <section id="ahora-hero" className="relative overflow-hidden" style={{ height: "100svh", minHeight: 600, background: "var(--cs-cellar)" }}>
        <div ref={imgRef} className="absolute left-0 w-full will-change-transform" style={{ top: "-6%", height: "112%" }}>
          <Image src={heroImage} alt="Sala de barricas de Cinco Sentidos" fill sizes="100vw" priority className="object-cover" />
        </div>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg,rgba(26,22,20,.55) 0%,rgba(26,22,20,.12) 34%,rgba(26,22,20,.86) 100%)" }}
        />
        <div
          ref={textRef}
          className="absolute left-0 right-0 bottom-0 will-change-transform"
          style={{ padding: "0 clamp(20px,5vw,56px) clamp(40px,8vh,72px)", color: "var(--cs-cream)" }}
        >
          <div className="cs-eyebrow" style={{ fontSize: 11, color: "var(--cs-brass-2)" }}>MI BARRICA</div>
          <h1 className="m-0 font-normal" style={{ marginTop: 14, fontSize: "clamp(64px,17vw,168px)", lineHeight: 0.88, letterSpacing: "-0.035em" }}>
            {variety}
            {vintage ? (
              <>
                <br />
                {vintage}
              </>
            ) : null}
          </h1>
          <div
            className="grid"
            style={{ marginTop: 26, maxWidth: 620, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", borderTop: "2px solid rgba(243,235,224,.7)" }}
          >
            {barrelNumber && (
              <div style={{ padding: "14px 16px 0 0" }}>
                <div className="cs-sans" style={label}>BARRICA</div>
                <div style={{ marginTop: 5, fontSize: 20 }}>{barrelNumber}</div>
              </div>
            )}
            <div style={{ padding: "14px 16px 0 0" }}>
              <div className="cs-sans" style={label}>ESTADO</div>
              <div style={{ marginTop: 5, fontSize: 20 }}>{statusLabel}</div>
            </div>
            {customerName && (
              <div style={{ paddingTop: 14 }}>
                <div className="cs-sans" style={label}>PROYECTO</div>
                <div className="italic" style={{ marginTop: 5, fontSize: 20 }}>{customerName}</div>
              </div>
            )}
          </div>
          <a
            href="#ahora"
            className="cs-sans flex items-center gap-3.5"
            style={{ marginTop: 36, fontSize: 11, letterSpacing: "0.2em", color: "var(--cs-cream)" }}
          >
            <span className="relative overflow-hidden" style={{ width: 1, height: 38, background: "rgba(243,235,224,.25)" }}>
              <span className="absolute inset-0" style={{ background: "var(--cs-cream)", animation: "cs-cue 2.4s cubic-bezier(.6,0,.3,1) infinite" }} />
            </span>
            DESCUBRÍ TU BARRICA
          </a>
        </div>
      </section>
    </>
  );
}
