"use client";

import React from "react";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  href?: string;
  className?: string;
  variant?: "default" | "gradient" | "outlined";
  color?: "default" | "primary" | "success" | "warning" | "danger";
}

const colorClasses = {
  default: {
    bg: "bg-white dark:bg-gray-800",
    icon: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
  },
  primary: {
    bg: "bg-white dark:bg-gray-800",
    icon: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
  },
  success: {
    bg: "bg-white dark:bg-gray-800",
    icon: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
  warning: {
    bg: "bg-white dark:bg-gray-800",
    icon: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  danger: {
    bg: "bg-white dark:bg-gray-800",
    icon: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  href,
  className = "",
  variant = "default",
  color = "default",
}: StatCardProps) {
  const colors = colorClasses[color];
  
  const content = (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-5
        ${variant === "outlined" ? `border ${colors.border}` : ""}
        ${colors.bg}
        ${variant === "gradient" ? "bg-gradient-to-br from-orange-500 to-pink-500 text-white" : ""}
        ${href ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer" : ""}
        transition-all duration-200
        ${className}
      `}
    >
      {/* Background decoration */}
      {variant === "default" && (
        <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
          <div className={`w-full h-full rounded-full opacity-10 ${colors.icon.split(" ")[0]}`}></div>
        </div>
      )}
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium mb-1 ${
            variant === "gradient" ? "text-white/80" : "text-gray-500 dark:text-gray-400"
          }`}>
            {title}
          </p>
          <p className={`text-2xl md:text-3xl font-bold mb-1 ${
            variant === "gradient" ? "text-white" : "text-gray-900 dark:text-white"
          }`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className={`text-sm ${
              variant === "gradient" ? "text-white/70" : "text-gray-500 dark:text-gray-400"
            }`}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend.isPositive !== false ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            }`}>
              {trend.isPositive !== false ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              <span className="font-medium">{trend.value}%</span>
              <span className={variant === "gradient" ? "text-white/60" : "text-gray-400"}>
                {trend.label}
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
            ${variant === "gradient" ? "bg-white/20" : colors.icon}
          `}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
