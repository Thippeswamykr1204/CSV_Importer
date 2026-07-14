"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImportStage } from "@/lib/types/crm";

const STAGE_LABELS: Record<Exclude<ImportStage, "done">, string> = {
  uploading: "Uploading",
  parsing: "Parsing CSV",
  batching: "Preparing batches",
  mapping: "AI mapping",
  validating: "Validation",
  finalizing: "Finalizing",
};

const STAGE_ORDER: Exclude<ImportStage, "done">[] = [
  "uploading",
  "parsing",
  "batching",
  "mapping",
  "validating",
  "finalizing",
];

interface ProgressStagesProps {
  currentStage: ImportStage;
  progress: number;
  message: string;
  batchesCompleted: number;
  totalBatches: number;
}

export function ProgressStages({
  currentStage,
  progress,
  message,
  batchesCompleted,
  totalBatches,
}: ProgressStagesProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number]);

  return (
    <div className="w-full">
      {/* Segmented rail — the signature interaction. Each stage is a segment
          that fills as it becomes active/complete, rather than a single
          generic progress bar, so the user always knows *what* is happening,
          not just *how much*. */}
      <div className="flex items-center gap-1.5">
        {STAGE_ORDER.map((stage, i) => {
          const isComplete = currentIndex > i || currentStage === "done";
          const isActive = currentIndex === i && currentStage !== "done";

          return (
            <div key={stage} className="flex-1">
              <div className="relative h-1.5 rounded-full bg-surface-raised overflow-hidden">
                <motion.div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    isComplete ? "bg-success" : "bg-accent"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: isComplete ? "100%" : isActive ? "60%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {isActive && (
                  <motion.div
                    className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {isComplete ? (
                  <Check className="size-3 text-success shrink-0" strokeWidth={2.5} />
                ) : isActive ? (
                  <Loader2 className="size-3 text-accent shrink-0 animate-spin" strokeWidth={2.5} />
                ) : (
                  <div className="size-3 shrink-0 rounded-full border border-border" />
                )}
                <span
                  className={cn(
                    "text-[11px] truncate",
                    isComplete && "text-success",
                    isActive && "text-foreground font-medium",
                    !isComplete && !isActive && "text-muted-2"
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface-raised px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative size-8 shrink-0">
            <svg className="size-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
              <motion.circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 14}
                initial={{ strokeDashoffset: 2 * Math.PI * 14 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 14 * (1 - progress / 100) }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono tabular text-foreground">
              {Math.round(progress)}
            </span>
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p className="text-[13px] text-foreground font-medium">{message}</p>
            {totalBatches > 0 && currentStage === "mapping" && (
              <p className="text-[11px] text-muted font-mono tabular mt-0.5">
                batch {batchesCompleted}/{totalBatches}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}