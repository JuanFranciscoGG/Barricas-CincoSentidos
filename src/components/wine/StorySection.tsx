import { Reveal } from "@/components/wine/Reveal";

/**
 * The owner's story, set as a pull-quote (as in the approved design): italic
 * Georgia, generous measure, no drop cap, hanging opening quote so all lines align. Paragraph breaks the owner typed are
 * preserved.
 */
export function StorySection({ text }: { text: string }) {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section id="historia" style={{ background: "var(--cs-paper-2)", borderTop: "2px solid var(--cs-ink)", borderBottom: "2px solid var(--cs-ink)" }}>
      <div className="cs-wrap" style={{ paddingTop: "clamp(56px,9vw,112px)", paddingBottom: "clamp(56px,9vw,112px)" }}>
        <div className="flex justify-between items-baseline gap-4 pb-3" style={{ borderBottom: "2px solid var(--cs-ink)" }}>
          <span className="cs-eyebrow" style={{ fontSize: 11, color: "var(--cs-ink)" }}>SU HISTORIA</span>
        </div>
        <Reveal style={{ marginTop: "clamp(28px,4vw,44px)", maxWidth: "26em" }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="italic"
              style={{
                position: "relative",
                textAlign: "left",
                margin: i === 0 ? 0 : "0.9em 0 0",
                fontSize: "clamp(26px,4.2vw,44px)",
                lineHeight: 1.25,
                letterSpacing: "-0.015em",
                textWrap: "pretty",
                overflowWrap: "anywhere",
              }}
            >
              {/* Hanging quote: sits in the margin so every line of the text starts at the same x. */}
              {i === 0 && (
                <span aria-hidden="true" style={{ position: "absolute", right: "100%", paddingRight: "0.06em" }}>
                  “
                </span>
              )}
              {p}
              {i === paragraphs.length - 1 && "”"}
            </p>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
