import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-muted border-border",
  accent: "bg-accent-muted text-accent border-accent/30",
  success: "bg-success-muted text-success border-success/30",
  warning: "bg-warning-muted text-warning border-warning/30",
  danger: "bg-danger-muted text-danger border-danger/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

/** Maps a 0-1 confidence score to a semantic tone, used consistently across preview & results. */
export function confidenceTone(confidence: number): BadgeTone {
  if (confidence >= 0.85) return "success";
  if (confidence >= 0.6) return "warning";
  return "danger";
}
