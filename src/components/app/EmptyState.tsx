"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  variant?: "default" | "minimal" | "card";
  className?: string;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className = "",
}: EmptyStateProps) {
  const iconElement = typeof icon === "string" ? (
    <span className="text-5xl mb-4">{icon}</span>
  ) : (
    <div className="mb-4">{icon}</div>
  );

  const content = (
    <div className={`text-center ${variant === "minimal" ? "py-8" : "py-12"} ${className}`}>
      {iconElement}
      <h3 className={`
        font-semibold text-gray-900 dark:text-white mb-2
        ${variant === "minimal" ? "text-base" : "text-lg"}
      `}>
        {title}
      </h3>
      {description && (
        <p className={`
          text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto
          ${variant === "minimal" ? "text-sm" : "text-base"}
        `}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                {action.label}
              </Link>
            ) : (
              <button
                onClick={action.onClick}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                {action.label}
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                onClick={secondaryAction.onClick}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
        {content}
      </div>
    );
  }

  return content;
}
