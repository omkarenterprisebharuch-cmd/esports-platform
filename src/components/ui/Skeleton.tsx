/**
 * Skeleton Loading Components
 * These provide instant visual feedback while content loads
 */

interface SkeletonProps {
  className?: string;
}

// Base skeleton component for custom shapes
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

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

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };
  return <div className={`${sizeClasses[size]} bg-gray-200 rounded-full animate-pulse`} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-gray-300 rounded" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1 h-4 bg-gray-200 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <SkeletonAvatar size="sm" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-10 bg-gray-100 rounded-lg w-full" />
        </div>
      ))}
      <div className="h-12 bg-gray-300 rounded-lg w-full" />
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <SkeletonAvatar size="lg" />
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4">
            <div className="h-4 bg-gray-200 rounded w-16 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
