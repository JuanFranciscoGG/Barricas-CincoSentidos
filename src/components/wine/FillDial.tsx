"use client";

import { useEffect, useState } from "react";

/** Vertical barrel-fill indicator — animates to `percent` shortly after mount. */
export function FillDial({ percent }: { percent: number }) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setFill(percent), 420);
    return () => window.clearTimeout(t);
  }, [percent]);

  const ease = "1800ms cubic-bezier(.22,.8,.3,1)";
  return (
    <div className="relative flex-none" style={{ width: 14, height: "min(440px,62vh)" }}>
      <div className="absolute top-0 bottom-0" style={{ left: 6, width: 2, background: "rgba(43,39,37,.14)" }} />
      <div className="absolute top-0" style={{ left: 6, width: 2, background: "var(--cs-wine)", height: `${fill}%`, transition: `height ${ease}` }} />
      <div className="absolute left-0" style={{ top: -2, width: 14, height: 14, background: "var(--cs-ink)" }} />
      <div
        className="absolute rounded-full"
        style={{
          left: -4,
          top: `${fill}%`,
          marginTop: -11,
          width: 22,
          height: 22,
          background: "var(--cs-wine)",
          boxShadow: "0 0 0 6px rgba(122,36,48,.14)",
          transition: `top ${ease}`,
        }}
      />
      <div className="absolute bottom-0" style={{ left: 1, width: 12, height: 12, border: "2px solid rgba(43,39,37,.35)" }} />
    </div>
  );
}
