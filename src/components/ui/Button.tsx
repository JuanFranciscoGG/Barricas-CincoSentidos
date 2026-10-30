import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,transform] duration-200 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

const variants: Record<Variant, string> = {
  primary: "bg-deep text-deep-ink hover:bg-brass",
  secondary: "border border-ink/40 bg-transparent text-ink hover:border-ink hover:bg-surface",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface",
  danger: "border border-sev-high text-sev-high hover:bg-sev-high-bg",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.14em] font-[family-name:var(--font-archivo)]",
  md: "px-4 py-2.5 text-xs uppercase tracking-[0.16em] font-[family-name:var(--font-archivo)]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
