type Tone = "neutral" | "brass" | "high" | "med" | "low";

const tones: Record<Tone, string> = {
  neutral: "bg-bg-alt text-ink-soft",
  brass: "bg-brass-tint text-brass-strong",
  high: "bg-sev-high-bg text-sev-high",
  med: "bg-sev-med-bg text-sev-med",
  low: "bg-sev-low-bg text-sev-low",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] font-[family-name:var(--font-archivo)] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
