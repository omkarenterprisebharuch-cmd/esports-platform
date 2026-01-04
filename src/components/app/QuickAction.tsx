"use client";

import React from "react";
import Link from "next/link";

interface QuickActionProps {
  icon: React.ReactNode | string;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outlined" | "gradient";
  color?: "default" | "primary" | "success" | "warning" | "danger";
  disabled?: boolean;
  className?: string;
}

const colorConfig = {
  default: {
    bg: "bg-gray-100 dark:bg-gray-700",
    hover: "hover:bg-gray-200 dark:hover:bg-gray-600",
    icon: "text-gray-600 dark:text-gray-400",
    text: "text-gray-900 dark:text-white",
    border: "border-gray-200 dark:border-gray-600",
    gradient: "from-gray-500 to-gray-600",
  },
  primary: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    hover: "hover:bg-orange-200 dark:hover:bg-orange-900/50",
    icon: "text-orange-600 dark:text-orange-400",
    text: "text-gray-900 dark:text-white",
    border: "border-orange-200 dark:border-orange-800",
    gradient: "from-orange-500 to-pink-500",
  },
  success: {
    bg: "bg-green-100 dark:bg-green-900/30",
    hover: "hover:bg-green-200 dark:hover:bg-green-900/50",
    icon: "text-green-600 dark:text-green-400",
    text: "text-gray-900 dark:text-white",
    border: "border-green-200 dark:border-green-800",
    gradient: "from-green-500 to-teal-500",
  },
  warning: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    hover: "hover:bg-amber-200 dark:hover:bg-amber-900/50",
    icon: "text-amber-600 dark:text-amber-400",
    text: "text-gray-900 dark:text-white",
    border: "border-amber-200 dark:border-amber-800",
    gradient: "from-amber-500 to-orange-500",
  },
  danger: {
    bg: "bg-red-100 dark:bg-red-900/30",
    hover: "hover:bg-red-200 dark:hover:bg-red-900/50",
    icon: "text-red-600 dark:text-red-400",
    text: "text-gray-900 dark:text-white",
    border: "border-red-200 dark:border-red-800",
    gradient: "from-red-500 to-pink-500",
  },
};

export function QuickAction({
  icon,
  label,
  description,
  href,
  onClick,
  variant = "default",
  color = "default",
  disabled = false,
  className = "",
}: QuickActionProps) {
  const colors = colorConfig[color];
  
  const iconElement = typeof icon === "string" ? (
    <span className="text-2xl">{icon}</span>
  ) : icon;

  const baseClasses = `
    flex items-center gap-4 p-4 rounded-xl transition-all duration-200
    ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"}
    ${className}
  `;

  const variantClasses = {
    default: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${disabled ? "" : colors.hover}`,
    outlined: `bg-transparent border ${colors.border} ${disabled ? "" : colors.hover}`,
    gradient: `bg-gradient-to-r ${colors.gradient} text-white`,
  };

  const content = (
    <>
      <div className={`
        flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
        ${variant === "gradient" ? "bg-white/20" : colors.bg}
        ${variant === "gradient" ? "text-white" : colors.icon}
      `}>
        {iconElement}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold ${variant === "gradient" ? "text-white" : colors.text}`}>
          {label}
        </h3>
        {description && (
          <p className={`text-sm ${variant === "gradient" ? "text-white/70" : "text-gray-500 dark:text-gray-400"}`}>
            {description}
          </p>
        )}
      </div>
      {!disabled && (
        <svg 
          className={`w-5 h-5 flex-shrink-0 ${variant === "gradient" ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={`${baseClasses} ${variantClasses[variant]}`}>
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} w-full text-left`}
    >
      {content}
    </button>
  );
}
