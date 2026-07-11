import { Skeleton } from "@/components/ui/skeleton";

/**
 * Next.js route-level loading UI (`app/loading.tsx`). This renders
 * automatically while `page.tsx` and its dependencies are still
 * streaming in on first navigation/load — the framework wires this up
 * via React Suspense with zero extra code on our end.
 *
 * Deliberately shaped to match the real upload screen 1:1 (same header
 * height, same centered hero, same dropzone footprint) rather than a
 * generic spinner — the goal is that the real content "resolves into
 * place" with no layout shift, not that the user notices a loading
 * screen at all.
 */
export default function Loading() {
  return (
    <div className="flex-1 flex flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading GrowEasy CSV Importer…</span>

      {/* Header skeleton — matches the real <header> exactly */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-[6px]" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
      </div>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        <div className="max-w-2xl mx-auto">
          {/* Hero text skeleton */}
          <div className="text-center mb-8 flex flex-col items-center gap-2.5">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-3.5 w-96 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>

          {/* Dropzone skeleton — same footprint as the real Dropzone component */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-border px-8 py-16">
            <Skeleton className="size-12 rounded-[var(--radius-md)]" />
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-3.5 w-64" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
      </main>
    </div>
  );
}