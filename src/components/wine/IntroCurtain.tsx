"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const LS_INTRO = "cs-portal-intro-seen";

/**
 * First-visit entrance: the cellar photo settles while the wine name rises
 * line by line, then the whole sheet lifts away (80ms, 1.9s, 2.8s, as in the
 * design). Tap to skip. Skipped entirely for reduced motion or repeat visits.
 */
export function IntroCurtain({ heroImage, variety, vintage, barrelNumber }: { heroImage: string; variety: string; vintage: number | null; barrelNumber: string | null }) {
  const [phase, setPhase] = useState<"off" | 0 | 1 | 2>("off");

  function end() {
    try {
      localStorage.setItem(LS_INTRO, "1");
    } catch {}
    setPhase("off");
  }

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(LS_INTRO);
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase(0), 0));
    timers.push(window.setTimeout(() => setPhase(1), 80));
    timers.push(window.setTimeout(() => setPhase(2), 1900));
    timers.push(window.setTimeout(() => end(), 2800));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === "off") return null;
  const entered = phase === 1 || phase === 2;
  const rise = entered ? "translateY(0)" : "translateY(105%)";
  const title = { fontSize: "clamp(64px,17vw,168px)", lineHeight: 0.92, letterSpacing: "-0.035em" } as const;

  return (
    <div
      onClick={end}
      className="fixed inset-0 overflow-hidden cursor-pointer"
      style={{ zIndex: 99, background: "var(--cs-ink)", color: "#efe8da", transform: phase === 2 ? "translateY(-100%)" : "none", transition: "transform .9s cubic-bezier(.76,0,.24,1)" }}
    >
      <Image src={heroImage} alt="" fill sizes="100vw" priority className="object-cover" style={{ opacity: entered ? 1 : 0, transform: entered ? "scale(1)" : "scale(1.12)", transition: "opacity 1.4s ease, transform 2.4s cubic-bezier(.22,.8,.3,1)" }} />
      <div className="absolute inset-0" style={{ background: "rgba(26,22,20,.55)" }} />
      <div className="absolute" style={{ left: "clamp(20px,5vw,56px)", right: "clamp(20px,5vw,56px)", bottom: "clamp(40px,10vh,90px)" }}>
        <div className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.26em", color: "var(--cs-brass-2)", opacity: entered ? 1 : 0, transition: "opacity .8s ease" }}>
          CINCO SENTIDOS{barrelNumber ? ` · BARRICA ${barrelNumber}` : ""}
        </div>
        <div className="overflow-hidden" style={{ marginTop: 16 }}>
          <div style={{ ...title, transform: rise, transition: "transform 1.1s cubic-bezier(.22,.8,.3,1)" }}>{variety}</div>
        </div>
        {vintage && (
          <div className="overflow-hidden">
            <div style={{ ...title, transform: rise, transition: "transform 1.1s cubic-bezier(.22,.8,.3,1) .12s" }}>{vintage}</div>
          </div>
        )}
        <div className="cs-sans" style={{ marginTop: 26, fontSize: 10, letterSpacing: "0.2em", color: "rgba(239,232,218,.6)", opacity: entered ? 1 : 0, transition: "opacity .8s ease .5s" }}>
          TOCÁ PARA ENTRAR
        </div>
      </div>
    </div>
  );
}
