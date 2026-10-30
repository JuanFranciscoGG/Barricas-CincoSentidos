import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const controlClass =
  "w-full border border-line-strong bg-surface-2 px-3 py-2 text-[0.95rem] text-ink placeholder:text-ink-faint transition-colors focus:outline-2 focus:outline-brass focus:border-brass";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-ink-faint font-[family-name:var(--font-archivo)]">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-ink-faint font-[family-name:var(--font-archivo)]">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}
