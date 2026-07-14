"use client";

import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface InlineAlertProps {
  message: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * A persistent, dismissible error surface — distinct from toast.
 *
 * Toasts are right for transient, non-blocking confirmations ("imported
 * 42 records"). They are the wrong tool for anything that blocks the
 * user from proceeding: a toast auto-dismisses in a few seconds, so a
 * user who looks away for a moment loses the only explanation for why
 * their upload didn't go through. This renders inline, next to the
 * control that caused the error, and stays until the user acts.
 */
export function InlineAlert({ message, onDismiss, className }: InlineAlertProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger/30 bg-danger-muted px-3.5 py-3",
        className
      )}
    >
      <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" strokeWidth={2} />
      <p className="text-[12.5px] text-danger leading-snug flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-danger/70 hover:text-danger shrink-0 cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
