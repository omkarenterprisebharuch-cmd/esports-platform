/**
 * Skeleton Loading Components
 * These provide instant visual feedback while content loads
 */

export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
          <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTournamentGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonBanner() {
  return (
    <div className="relative h-64 md:h-80 bg-gray-200 rounded-xl overflow-hidden animate-pulse">
      <div className="absolute bottom-4 left-4 right-4 space-y-2">
        <div className="h-6 bg-gray-300 rounded w-24" />
        <div className="h-8 bg-gray-300 rounded w-3/4" />
        <div className="h-4 bg-gray-300 rounded w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonStatsGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="h-4 bg-gray-200 rounded w-16 mx-auto mb-2" />
          <div className="h-8 bg-gray-200 rounded w-20 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetails() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-5 bg-gray-200 rounded w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonText({ width = "w-full", height = "h-4" }: { width?: string; height?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${width} ${height}`} />;
}

export function SkeletonButton({ className = "" }: { className?: string }) {
  return <div className={`h-10 bg-gray-200 rounded-lg animate-pulse ${className}`} />;
}
