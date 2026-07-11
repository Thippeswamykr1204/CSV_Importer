import { cn } from "@/lib/utils/cn";

/**
 * Base shimmer block. Uses a moving gradient rather than a flat pulse —
 * reads as "actively loading" instead of "broken/half-rendered," which
 * matters more the longer a skeleton stays on screen.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-sm)] bg-surface-raised",
        className
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />
    </div>
  );
}