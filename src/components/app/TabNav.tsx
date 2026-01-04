"use client";

import React from "react";
import Link from "next/link";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode | string;
  badge?: string | number;
  href?: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onChange?: (tabId: string) => void;
  variant?: "default" | "pills" | "underline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
}

export function TabNav({
  tabs,
  activeTab,
  onChange,
  variant = "default",
  size = "md",
  fullWidth = false,
  className = "",
}: TabNavProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  const variantClasses = {
    default: {
      container: "bg-gray-100 dark:bg-gray-800 p-1 rounded-xl",
      active: "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm",
      inactive: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
    },
    pills: {
      container: "gap-2",
      active: "bg-gray-900 dark:bg-white text-white dark:text-gray-900",
      inactive: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
    },
    underline: {
      container: "border-b border-gray-200 dark:border-gray-700 gap-4",
      active: "text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white -mb-px",
      inactive: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent",
    },
  };

  const classes = variantClasses[variant];

  const renderTab = (tab: Tab) => {
    const isActive = activeTab === tab.id;
    const icon = typeof tab.icon === "string" ? (
      <span>{tab.icon}</span>
    ) : tab.icon;

    const tabContent = (
      <>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{tab.label}</span>
        {tab.badge !== undefined && (
          <span className={`
            ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full
            ${isActive 
              ? "bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200" 
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            }
          `}>
            {tab.badge}
          </span>
        )}
      </>
    );

    const tabClasses = `
      ${sizeClasses[size]}
      ${isActive ? classes.active : classes.inactive}
      ${fullWidth ? "flex-1" : ""}
      rounded-lg font-medium transition-all duration-200
      flex items-center justify-center gap-2
      focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 focus:ring-offset-2
    `;

    if (tab.href) {
      return (
        <Link
          key={tab.id}
          href={tab.href}
          className={tabClasses}
        >
          {tabContent}
        </Link>
      );
    }

    return (
      <button
        key={tab.id}
        onClick={() => onChange?.(tab.id)}
        className={tabClasses}
      >
        {tabContent}
      </button>
    );
  };

  return (
    <nav 
      className={`flex ${fullWidth ? "w-full" : ""} ${classes.container} ${className}`}
      role="tablist"
    >
      {tabs.map(renderTab)}
    </nav>
  );
}
