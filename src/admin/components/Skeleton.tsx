/**
 * Reusable skeleton / shimmer components for loading states.
 *
 * Usage:
 *   <Skeleton className="h-10 w-40" />           // single block
 *   <SkeletonText lines={3} />                    // paragraph placeholder
 *   <DashboardSkeleton />                         // full dashboard loading
 *   <TableSkeleton rows={5} cols={4} />           // table loading
 *   <CardSkeleton />                              // single stat card
 *   <FormSkeleton />                              // form loading
 */

/* ── Base shimmer block ────────────────────────────────────────── */
export function Skeleton({
  className = "",
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${rounded} ${className}`}
      style={{ animationDuration: "1.5s", animationTimingFunction: "ease-in-out" }}
    />
  );
}

/* ── Skeleton text lines ───────────────────────────────────────── */

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
          rounded="rounded-md"
        />
      ))}
    </div>
  );
}

/* ── Stat card skeleton ────────────────────────────────────────── */

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" rounded="rounded-md" />
        <Skeleton className="h-9 w-9" rounded="rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-8 w-16" rounded="rounded-md" />
    </div>
  );
}

/* ── Dashboard skeleton ────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Skeleton className="h-7 w-56" rounded="rounded-lg" />
        <Skeleton className="mt-3 h-4 w-80" rounded="rounded-md" />
        <Skeleton className="mt-4 h-6 w-24" rounded="rounded-full" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/* ── Table skeleton ────────────────────────────────────────────── */

export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Table header */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-20" rounded="rounded-md" />
          ))}
        </div>
      </div>
      {/* Table rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-4 px-6 py-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="h-9 w-9 shrink-0" rounded="rounded-full" />
              <div className="space-y-1.5 min-w-0 flex-1">
                <Skeleton className="h-4 w-28" rounded="rounded-md" />
                <Skeleton className="h-3 w-36" rounded="rounded-md" />
              </div>
            </div>
            {/* Other columns */}
            {Array.from({ length: cols - 1 }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={`h-4 ${colIdx === cols - 2 ? "w-16" : "w-24"}`}
                rounded="rounded-md"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Form skeleton ─────────────────────────────────────────────── */

export function FormSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <Skeleton className="h-4 w-32" rounded="rounded-md" />
        <Skeleton className="mt-1.5 h-3 w-48" rounded="rounded-md" />
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Skeleton className="h-3.5 w-16 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-12 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-12 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-14 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-14 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-16 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-20 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div className="sm:col-span-2">
            <Skeleton className="h-3.5 w-14 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Skeleton className="h-9 w-20" rounded="rounded-xl" />
          <Skeleton className="h-9 w-28" rounded="rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ── Profile skeleton ──────────────────────────────────────────── */

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" rounded="rounded-md" />
          <Skeleton className="h-3.5 w-36" rounded="rounded-md" />
        </div>
      </div>
      {/* Profile card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <Skeleton className="h-4 w-36" rounded="rounded-md" />
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-5">
            <Skeleton className="h-20 w-20" rounded="rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" rounded="rounded-md" />
              <Skeleton className="h-3 w-20" rounded="rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Skeleton className="h-3.5 w-16 mb-2" rounded="rounded-md" />
              <Skeleton className="h-10 w-full" rounded="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Skeleton className="h-3.5 w-12 mb-2" rounded="rounded-md" />
              <Skeleton className="h-10 w-full" rounded="rounded-xl" />
            </div>
            <div>
              <Skeleton className="h-3.5 w-12 mb-2" rounded="rounded-md" />
              <Skeleton className="h-10 w-full" rounded="rounded-xl" />
            </div>
            <div>
              <Skeleton className="h-3.5 w-14 mb-2" rounded="rounded-md" />
              <Skeleton className="h-10 w-full" rounded="rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      {/* Password card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <Skeleton className="h-4 w-32" rounded="rounded-md" />
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Skeleton className="h-3.5 w-24 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-20 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-3.5 w-28 mb-2" rounded="rounded-md" />
            <Skeleton className="h-10 w-full" rounded="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page header skeleton ──────────────────────────────────────── */

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-32" rounded="rounded-md" />
        <Skeleton className="h-3.5 w-48" rounded="rounded-md" />
      </div>
      <Skeleton className="h-9 w-36" rounded="rounded-xl" />
    </div>
  );
}
