"use client";

import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  onRowClick?: (item: T) => void;
  selectedKey?: string | number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = "No data found",
  emptyIcon = "📭",
  onRowClick,
  selectedKey,
  className = "",
}: DataTableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              {columns.map((col) => (
                <div key={col.key} className="h-4 bg-gray-200 dark:bg-gray-600 rounded" style={{ width: col.width || "auto", flex: col.width ? undefined : 1 }} />
              ))}
            </div>
          </div>
          {/* Rows skeleton */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex gap-4">
                {columns.map((col) => (
                  <div key={col.key} className="h-4 bg-gray-100 dark:bg-gray-700 rounded" style={{ width: col.width || "auto", flex: col.width ? undefined : 1 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center ${className}`}>
        <span className="text-4xl mb-4 block">{emptyIcon}</span>
        <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 text-xs font-semibold uppercase tracking-wider
                    text-gray-500 dark:text-gray-400
                    ${alignClasses[col.align || "left"]}
                  `}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.map((item) => {
              const key = keyExtractor(item);
              const isSelected = selectedKey === key;
              
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item)}
                  className={`
                    ${onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" : ""}
                    ${isSelected ? "bg-orange-50 dark:bg-orange-900/20" : ""}
                    transition-colors
                  `}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        px-4 py-4 text-sm text-gray-900 dark:text-gray-100
                        ${alignClasses[col.align || "left"]}
                      `}
                    >
                      {col.render 
                        ? col.render(item) 
                        : String((item as Record<string, unknown>)[col.key] ?? "")
                      }
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
