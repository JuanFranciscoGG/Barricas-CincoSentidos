import { Reveal } from "@/components/wine/Reveal";
import { AgingGauge } from "@/components/wine/AgingGauge";
import type { LatestItem } from "@/lib/barrel-notes";

const fmtLong = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

export function NowPanel({
  startDate,
  daysAging,
  progress,
  estimatedMonths,
  bottled,
  nextOperation,
  extra,
}: {
  startDate: Date | null;
  daysAging: number;
  progress: number | null;
  estimatedMonths: number | null;
  bottled: boolean;
  nextOperation: { date: Date; title: string; daysAway: number } | null;
  /** Optional entry point rendered below the milestone (e.g. "Mi barrica hoy"). */
  extra?: React.ReactNode;
}) {
  const stages = [
    {
      name: "Llenado",
      status: startDate ? `Completada · ${startDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : "Completada",
      state: "done",
    },
    { name: "Crianza", status: bottled ? "Completada" : "En curso", state: bottled ? "done" : "now" },
    { name: "Embotellado", status: bottled ? "Completado" : "Pendiente", state: bottled ? "done" : "todo" },
  ];
  const small = { fontSize: 10, letterSpacing: "0.2em", color: "var(--cs-ink-faint)" } as const;

  return (
    <section id="ahora" className="cs-wrap" style={{ paddingTop: "clamp(64px,10vw,120px)", paddingBottom: "clamp(56px,8vw,96px)" }}>
      <div className="flex justify-between items-baseline gap-4 pb-3" style={{ borderBottom: "2px solid var(--cs-ink)" }}>
        <span className="cs-eyebrow" style={{ fontSize: 11, color: "var(--cs-ink)" }}>AHORA</span>
        <span className="cs-meta">{fmtLong(new Date()).toUpperCase()}</span>
      </div>

      <div className="grid mt-11" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(40px,6vw,88px)" }}>
        <AgingGauge
          days={daysAging}
          progress={progress}
          startLabel={startDate ? fmtLong(startDate) : "—"}
          estimatedMonths={estimatedMonths}
        />

        <div className="flex flex-col" style={{ gap: 40 }}>
          <div>
            <div className="cs-sans" style={{ ...small, marginBottom: 12 }}>ETAPAS</div>
            <div className="grid grid-cols-3" style={{ borderTop: "2px solid var(--cs-ink)", borderLeft: "1px solid var(--cs-line-strong)" }}>
              {stages.map((s, i) => (
                <Reveal
                  key={s.name}
                  style={{
                    padding: "16px 14px 18px",
                    borderRight: "1px solid var(--cs-line-strong)",
                    borderBottom: "1px solid var(--cs-line-strong)",
                    background: s.state === "now" ? "var(--cs-wine)" : "transparent",
                    color: s.state === "now" ? "var(--cs-cream)" : s.state === "todo" ? "var(--cs-ink-faint)" : "var(--cs-ink)",
                  }}
                >
                  <div className="cs-sans" style={{ fontSize: 10, letterSpacing: "0.18em", opacity: 0.75 }}>0{i + 1}</div>
                  <div style={{ marginTop: 12, fontSize: 22, lineHeight: 1.1 }}>{s.name}</div>
                  <div className="cs-sans" style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.06em", opacity: 0.85 }}>{s.status}</div>
                </Reveal>
              ))}
            </div>
          </div>

          {nextOperation && (
            <Reveal className="flex justify-between items-end gap-4 pt-4" style={{ borderTop: "2px solid var(--cs-ink)" }}>
              <div className="min-w-0">
                <div className="cs-sans" style={small}>PRÓXIMO HITO</div>
                <div style={{ marginTop: 10, fontSize: 24, lineHeight: 1.15 }}>{nextOperation.title}</div>
                <div className="cs-sans" style={{ marginTop: 6, fontSize: 12, color: "var(--cs-ink-soft)" }}>{fmtLong(nextOperation.date)}</div>
              </div>
              <div className="text-right flex-none">
                <div style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.02em" }}>{nextOperation.daysAway}</div>
                <div className="cs-sans" style={{ ...small, marginTop: 4, letterSpacing: "0.18em" }}>DÍAS</div>
              </div>
            </Reveal>
          )}
          {extra}
        </div>
      </div>
    </section>
  );
}

/** "Lo último" — full-bleed wine band with the most recent customer-visible moment. */
export function LatestBand({ moment }: { moment: LatestItem }) {
  return (
    <section id="ultimo" style={{ background: "var(--cs-wine)", color: "var(--cs-cream)" }}>
      <div className="cs-wrap" style={{ paddingTop: "clamp(64px,10vw,120px)", paddingBottom: "clamp(64px,10vw,120px)" }}>
        <span className="cs-eyebrow" style={{ fontSize: 11, color: "inherit" }}>LO ÚLTIMO</span>
        <Reveal className="cs-sans" style={{ marginTop: 40, fontSize: 12, letterSpacing: "0.14em", color: "rgba(243,235,224,.8)" }}>
          {fmtLong(moment.date).toUpperCase()}
        </Reveal>
        <Reveal>
          <p style={{ margin: "14px 0 0", fontSize: "clamp(44px,10vw,104px)", lineHeight: 0.98, letterSpacing: "-0.03em", maxWidth: "15ch", textWrap: "balance" }}>
            &ldquo;{moment.title}&rdquo;
          </p>
        </Reveal>
        {moment.note && (
          <Reveal>
            <p style={{ margin: "28px 0 0", fontSize: "clamp(19px,2.4vw,24px)", lineHeight: 1.55, maxWidth: "34em", color: "rgba(243,235,224,.9)", textWrap: "pretty" }}>
              {moment.note}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
