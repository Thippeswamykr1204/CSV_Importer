import { Skeleton } from "@/components/ui/skeleton";

/**
 * Root loading UI — shown while the landing page (app/page.tsx) streams
 * in on first load. Shaped to match the real two-column hero (copy +
 * product mockup card) so content resolves into place with no layout
 * shift. The /import route has its own loading.tsx matching the
 * importer's shape instead.
 */
export default function Loading() {
  return (
    <div className="flex-1 flex flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading GrowEasy CSV Importer…</span>

      <div className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-[6px]" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-8 w-32 rounded-[var(--radius-sm)]" />
        </div>
      </div>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Skeleton className="h-6 w-48 rounded-full mb-6" />
            <Skeleton className="h-9 w-full max-w-md mb-2" />
            <Skeleton className="h-9 w-3/4 max-w-sm mb-5" />
            <Skeleton className="h-4 w-full max-w-md mb-2" />
            <Skeleton className="h-4 w-2/3 max-w-sm mb-8" />
            <div className="flex gap-3">
              <Skeleton className="h-11 w-40 rounded-[var(--radius-sm)]" />
              <Skeleton className="h-11 w-48 rounded-[var(--radius-sm)]" />
            </div>
          </div>
          <Skeleton className="h-80 w-full rounded-[var(--radius-lg)]" />
        </div>
      </main>
    </div>
  );
}