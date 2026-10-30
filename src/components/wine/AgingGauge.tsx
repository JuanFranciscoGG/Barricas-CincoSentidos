"use client";

import { useEffect, useRef, useState } from "react";
import { FillDial } from "@/components/wine/FillDial";

/**
 * The "Ahora" gauge: once the section scrolls into view, the barrel fills to
 * the real aging percentage and the day counter counts up to the real number
 * of days since filling (cubic ease-out, 1.7s). Reduced motion jumps to the end.
 */
export function AgingGauge({
  days,
  progress,
  startLabel,
  estimatedMonths,
}: {
  days: number;
  progress: number | null;
  startLabel: string;
  estimatedMonths: number | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const pct = progress ?? 0;
  const small = { fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-ink-faint)" } as const;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.72) {
        setActive(true);
        window.removeEventListener("scroll", check);
        window.removeEventListener("resize", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setCount(days));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 1700));
      setCount(Math.round(days * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, days]);

  return (
    <div ref={rootRef} className="flex" style={{ gap: 26 }}>
      <FillDial percent={active ? pct : 0} />
      <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ height: "min(440px,62vh)" }}>
        <div>
          <div className="cs-sans" style={small}>LLENADO</div>
          <div style={{ marginTop: 4, fontSize: 17 }}>{startLabel}</div>
        </div>
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span style={{ fontSize: "clamp(96px,22vw,168px)", lineHeight: 0.8, letterSpacing: "-0.045em", fontVariantNumeric: "lining-nums tabular-nums" }}>
              {count}
            </span>
            <span style={{ fontSize: 19, color: "var(--cs-ink-soft)" }}>días en crianza</span>
          </div>
          {progress !== null && (
            <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
              <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--cs-wine)" }}>{pct}% DE LA CRIANZA</span>
              <span className="flex-1 h-px" style={{ background: "rgba(43,39,37,.2)" }} />
            </div>
          )}
        </div>
        <div>
          {estimatedMonths ? (
            <>
              <div className="cs-sans" style={small}>CRIANZA ESTIMADA</div>
              <div className="italic" style={{ marginTop: 4, fontSize: 17, color: "var(--cs-ink-soft)" }}>{estimatedMonths} meses</div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
