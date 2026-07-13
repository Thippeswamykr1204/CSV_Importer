"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  widthClassName?: string;
}

export function Modal({ open, onClose, title, description, children, widthClassName }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "relative w-full rounded-[var(--radius-lg)] border border-border bg-surface shadow-2xl max-h-[85vh] overflow-hidden flex flex-col",
              widthClassName ?? "max-w-md"
            )}
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4 shrink-0">
              <div>
                <h2 id="modal-title" className="text-[14px] font-medium text-foreground">
                  {title}
                </h2>
                {description && <p className="text-[12px] text-muted mt-0.5">{description}</p>}
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close dialog"
                className="text-muted hover:text-foreground shrink-0 -mr-1 -mt-1 p-1.5 rounded-[var(--radius-sm)] hover:bg-surface-raised transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}