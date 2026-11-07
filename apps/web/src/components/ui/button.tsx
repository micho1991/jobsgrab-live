import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const base = "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-control)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-hover",
  secondary: "bg-white text-ink border border-line hover:border-steel-light hover:bg-mist",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-white text-bad border border-bad/30 hover:bg-bad-bg",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-[15px]", lg: "h-11 px-5 text-[15px]" };

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cn(base, variants[variant], sizes[size], extra);

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
