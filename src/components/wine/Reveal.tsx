"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades/slides a block in the first time it scrolls into view. Matches the
 * `data-reveal` treatment in the source design — purely decorative, no data
 * dependency, safe to wrap around any server-rendered content.
 */
export function Reveal({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const checkNow = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) setRevealed(true);
    };
    checkNow();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);

    // Pages opened from a QR/NFC scanner are often backgrounded in a webview
    // or "custom tab" at first load, and browsers throttle IntersectionObserver
    // while the document is hidden — re-check once it's actually visible so
    // content already in view doesn't stay stuck invisible.
    const onVisible = () => {
      if (document.visibilityState === "visible") checkNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", checkNow);

    // Last-resort safety net: this is real content, not just decoration, so
    // it must never stay permanently invisible even if the observer never
    // fires on some device/browser combination.
    const fallback = window.setTimeout(() => setRevealed(true), 2500);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", checkNow);
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={ref} className={`cs-reveal ${className}`} data-revealed={revealed} style={style}>
      {children}
    </div>
  );
}
