"use client";

import { useEffect, useRef, useState } from "react";
import type { FactChip, OriginPlace } from "@/lib/knowledge";

// Shared real-world scale every origin is placed on, so a marker's position
// is always relative to the same range rather than tuned per place — this is
// what makes the position genuinely data-driven instead of a hardcoded pin.
// 400m is roughly the Mendoza plain floor (e.g. Palmira/Este); 1900m is
// roughly the high end of cultivated Valle de Uco (e.g. upper Gualtallary).
const ELEVATION_MIN = 400;
const ELEVATION_MAX = 1900;

const X_PLAINS = 266;
const X_ANDES = 30;
const Y_PLAINS = 130;
const Y_ANDES = 20;
const VB_W = 300;
const VB_H = 170;

function elevationT(meters: number) {
  const clamped = Math.min(ELEVATION_MAX, Math.max(ELEVATION_MIN, meters));
  return (clamped - ELEVATION_MIN) / (ELEVATION_MAX - ELEVATION_MIN);
}

/** A point on the terrain silhouette for a given 0..1 position between the plains and the Andes. */
function terrainPoint(t: number) {
  const eased = Math.pow(t, 1.4); // foothills rise gently at first, then steepen toward the Andes
  return {
    x: X_PLAINS - (X_PLAINS - X_ANDES) * t,
    y: Y_PLAINS - (Y_PLAINS - Y_ANDES) * eased,
  };
}

const TERRAIN_STEPS = 28;
const TERRAIN_POINTS = Array.from({ length: TERRAIN_STEPS + 1 }, (_, i) => terrainPoint(i / TERRAIN_STEPS));
// The silhouette runs edge to edge: it keeps climbing past the last Andes
// sample on the left and levels out on the Mendoza plain to the right.
const RIDGE_LINE = `M ${VB_W} ${Y_PLAINS + 5} L ${TERRAIN_POINTS.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} L 0 6`;
const GROUND_FILL = `${RIDGE_LINE} L 0 156 L ${VB_W} 156 Z`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Spot {
  key: string;
  label: string;
  title: string;
  value: string;
  x: number;
  y: number;
}

export function OriginMap({ place }: { place: OriginPlace }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);

  // Draw-on trigger, same threshold as the design (section top at 80% of viewport).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const check = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.8) {
        setSeen(true);
        window.removeEventListener("scroll", check);
      }
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  const marker = place.elevationMeters !== null ? terrainPoint(elevationT(place.elevationMeters)) : null;

  // Hotspots come from the place's own fact chips (elevation already has its own readout).
  const chips = place.factChips.filter((c: FactChip) => !norm(c.label).startsWith("elevacion"));
  const anchor = marker ?? terrainPoint(0.5);
  const spots: Spot[] = [];
  if (place.teaser || chips.length) {
    chips.slice(0, 3).forEach((c, i) => {
      const n = norm(c.label);
      const underground = n.startsWith("suelo");
      const sky = n.startsWith("clima");
      spots.push({
        key: `chip-${i}`,
        label: c.label.toUpperCase(),
        title: c.label,
        value: c.value,
        x: clamp(anchor.x + (sky ? 20 : underground ? 6 : -30), 24, 276),
        y: underground ? Math.min(150, anchor.y + (156 - anchor.y) * 0.55) : sky ? Math.max(12, anchor.y - 52) : Math.max(12, anchor.y - 18 - i * 6),
      });
    });
  }
  const panels = [
    { key: null as string | null, num: "", title: `${place.title}, punto por punto`, value: "Tocá los puntos del gráfico para descubrir el terroir." },
    ...spots.map((s, i) => ({ key: s.key as string | null, num: `0${i + 1} / 0${spots.length}`, title: s.title, value: s.value })),
  ];

  const ease = "cubic-bezier(.22,.8,.3,1)";
  // non-scaling-stroke measures dashes in screen px, so use a length well above any real path length.
  const dash = { strokeDasharray: 10000, strokeDashoffset: seen ? 0 : 10000 } as const;
  const fade = (delay: string, dur = "1s") => ({ opacity: seen ? 1 : 0, transition: `opacity ${dur} ease ${delay}` });

  return (
    <div ref={rootRef} style={{ paddingTop: 36 }}>
      <div className="grid items-end" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: "28px 64px" }}>
        <div>
          <h2 className="font-normal" style={{ margin: 0, fontSize: "clamp(64px,13vw,128px)", lineHeight: 0.86, letterSpacing: "-0.04em" }}>
            {place.title}
          </h2>
          {place.locationLine && (
            <div className="cs-sans" style={{ marginTop: 18, fontSize: 11, letterSpacing: "0.1em", color: "var(--cs-ink-faint)" }}>
              {place.locationLine.toUpperCase()}
            </div>
          )}
          {place.teaser && (
            <p style={{ margin: "22px 0 0", fontSize: 20, lineHeight: 1.55, maxWidth: "28em", textWrap: "pretty" }}>{place.teaser}</p>
          )}
        </div>
        {place.elevationMeters !== null && (
          <div>
            <div className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-wine)" }}>ELEVACIÓN</div>
            <div className="flex items-baseline gap-2.5" style={{ marginTop: 8 }}>
              <span style={{ fontSize: "clamp(60px,11vw,112px)", lineHeight: 0.88, letterSpacing: "-0.045em", fontVariantNumeric: "lining-nums" }}>
                {place.elevationMeters.toLocaleString("es-AR")}
              </span>
              <span style={{ fontSize: 26 }}>m</span>
            </div>
            <div className="cs-sans" style={{ marginTop: 10, fontSize: 12, color: "var(--cs-ink-soft)" }}>Aproximada, sobre el nivel del mar</div>
          </div>
        )}
      </div>

      <div className="relative" style={{ marginTop: 48, height: "clamp(300px,44vw,480px)" }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", overflow: "visible" }}>
          <defs>
            <pattern id="csGrava" width="6" height="4" patternUnits="userSpaceOnUse">
              <circle cx="1.4" cy="1.4" r="0.55" fill="#2B2725" fillOpacity=".26" />
              <circle cx="4.3" cy="3" r="0.36" fill="#2B2725" fillOpacity=".18" />
            </pattern>
          </defs>
          <path d={GROUND_FILL} fill="url(#csGrava)" style={fade(".6s", "1.4s")} />
          <path d={GROUND_FILL} fill="var(--cs-line)" style={fade(".6s", "1.4s")} />
          <path
            d={RIDGE_LINE}
            fill="none"
            stroke="#2B2725"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ ...dash, transition: `stroke-dashoffset 2.2s ${ease}` }}
          />
          {marker && (
            <>
              <line x1={0} x2={VB_W} y1={marker.y} y2={marker.y} stroke="#7A2430" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" style={fade(".9s")} />
              <line x1={marker.x} x2={marker.x} y1={marker.y} y2={156} stroke="#7A2430" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={fade("1.4s", ".8s")} />
            </>
          )}
        </svg>
        <div className="cs-sans absolute" style={{ left: 0, top: 0, fontSize: 11, letterSpacing: "0.2em", color: "var(--cs-ink-soft)", ...fade(".4s") }}>
          CORDILLERA DE LOS ANDES
        </div>
        <div className="cs-sans absolute" style={{ right: 0, bottom: 0, fontSize: 11, letterSpacing: "0.2em", color: "var(--cs-ink-soft)", ...fade(".4s") }}>
          MENDOZA
        </div>
        {marker && place.elevationMeters !== null && (
          <div
            className="cs-sans absolute"
            style={{ right: 0, top: `calc(${(marker.y / VB_H) * 100}% - 20px)`, fontSize: 11, letterSpacing: "0.08em", color: "var(--cs-wine)", ...fade("1s") }}
          >
            {place.elevationMeters.toLocaleString("es-AR")} m
          </div>
        )}
        {marker && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{ left: `${(marker.x / VB_W) * 100}%`, top: `${(marker.y / VB_H) * 100}%`, width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: "50%", background: "var(--cs-wine)", boxShadow: "0 0 0 6px rgba(122,36,48,.14)", ...fade("1.4s", ".8s") }}
          />
        )}
        {spots.map((sp, i) => {
          const on = active === sp.key;
          return (
            <button
              key={sp.key}
              onClick={() => setActive(on ? null : sp.key)}
              aria-pressed={on}
              className="absolute flex items-center"
              style={{
                left: `${(sp.x / VB_W) * 100}%`,
                top: `${(sp.y / VB_H) * 100}%`,
                transform: "translate(-22px,-50%)",
                height: 44,
                gap: 8,
                paddingRight: 8,
                opacity: seen ? 1 : 0,
                transition: `opacity .8s ease ${1.5 + i * 0.15}s`,
              }}
            >
              <span className="relative flex items-center justify-center flex-none" style={{ width: 44, height: 44 }}>
                <span className="absolute rounded-full cs-breathe" style={{ width: 30, height: 30, border: "1px solid var(--cs-wine)" }} />
                <span className="rounded-full" style={{ width: 14, height: 14, border: "2px solid var(--cs-wine)", background: on ? "var(--cs-wine)" : "var(--cs-paper-2)", transition: "background .3s ease" }} />
              </span>
              <span className="cs-sans" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--cs-ink)", background: "rgba(246,241,231,.85)", padding: "3px 5px" }}>
                {sp.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ borderTop: "2px solid var(--cs-ink)" }}>
        {panels.map((p) => {
          const on = p.key === active;
          return (
            <div
              key={p.key ?? "idle"}
              aria-live="polite"
              className="grid items-start"
              style={{
                gridArea: "1 / 1",
                padding: "26px 0 30px",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))",
                gap: "14px clamp(24px,5vw,64px)",
                opacity: on ? 1 : 0,
                transform: on ? "none" : "translate3d(0,10px,0)",
                pointerEvents: on ? "auto" : "none",
                transition: `opacity .45s ease, transform .6s ${ease}`,
              }}
            >
              <div className="flex items-baseline gap-3.5">
                {p.num && (
                  <span className="cs-sans" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--cs-wine)", fontVariantNumeric: "tabular-nums" }}>{p.num}</span>
                )}
                <span className="italic" style={{ fontSize: "clamp(30px,4.4vw,44px)", lineHeight: 1, letterSpacing: "-0.015em" }}>{p.title}</span>
              </div>
              <div style={{ borderLeft: "2px solid var(--cs-wine)", padding: "2px 0 2px 20px" }}>
                <p style={{ margin: 0, fontSize: "clamp(20px,2.6vw,26px)", lineHeight: 1.38, letterSpacing: "-0.005em", maxWidth: "22em", textWrap: "pretty" }}>{p.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {place.narrative && (
        <div style={{ borderTop: "1px solid var(--cs-line-strong)", marginTop: 10 }}>
          <button
            onClick={() => setPairing(!pairing)}
            className="cs-sans w-full flex items-center justify-between gap-4 text-left"
            style={{ padding: "16px 0", fontSize: 11, fontWeight: 500, letterSpacing: "0.2em" }}
          >
            <span>{pairing ? `CERRAR — ${place.title.toUpperCase()}` : `POR QUÉ ${place.title.toUpperCase()} — DESCUBRIR`}</span>
            <span style={{ fontSize: 20, color: "var(--cs-wine)", transform: pairing ? "rotate(45deg)" : "none", transition: `transform .45s ${ease}` }}>+</span>
          </button>
          <div className="grid" style={{ gridTemplateRows: pairing ? "1fr" : "0fr", transition: `grid-template-rows .6s ${ease}` }}>
            <div className="overflow-hidden">
              <p style={{ margin: "0 0 18px", fontSize: 18, lineHeight: 1.65, color: "#3e3834", maxWidth: "40em", textWrap: "pretty" }}>{place.narrative}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
