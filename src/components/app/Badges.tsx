"use client";

import React from "react";

// Game type configuration
const GAME_CONFIG: Record<string, { emoji: string; color: string; name: string }> = {
  freefire: { emoji: "🔥", color: "from-orange-500 to-red-500", name: "Free Fire" },
  pubg: { emoji: "🎯", color: "from-yellow-500 to-orange-500", name: "PUBG" },
  valorant: { emoji: "⚔️", color: "from-red-500 to-pink-500", name: "Valorant" },
  codm: { emoji: "🔫", color: "from-green-500 to-teal-500", name: "COD Mobile" },
};

interface GameBadgeProps {
  game: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

export function GameBadge({ game, size = "md", showName = false, className = "" }: GameBadgeProps) {
  const config = GAME_CONFIG[game] || { emoji: "🎮", color: "from-gray-500 to-gray-600", name: game };
  
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span 
        className={`${sizeClasses[size]} drop-shadow-sm`}
        role="img" 
        aria-label={config.name}
      >
        {config.emoji}
      </span>
      {showName && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {config.name}
        </span>
      )}
    </div>
  );
}

// Status configuration
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Upcoming" },
  registration_open: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", label: "Registration Open" },
  ongoing: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Live" },
  completed: { bg: "bg-gray-100 dark:bg-gray-700/40", text: "text-gray-600 dark:text-gray-400", label: "Completed" },
  cancelled: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
  draft: { bg: "bg-gray-100 dark:bg-gray-700/40", text: "text-gray-500 dark:text-gray-400", label: "Draft" },
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, size = "md", className = "", pulse = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-xs",
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${config.bg} ${config.text} ${sizeClasses[size]} ${className}
      `}
    >
      {(status === "ongoing" || pulse) && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {config.label}
    </span>
  );
}

// Role configuration
const ROLE_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  player: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-300", icon: "🎮" },
  organizer: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", icon: "🏆" },
  owner: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", icon: "👑" },
  host: { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300", icon: "⚙️" },
  admin: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", icon: "🛡️" },
};

interface RoleBadgeProps {
  role: string;
  showIcon?: boolean;
  className?: string;
}

export function RoleBadge({ role, showIcon = true, className = "" }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.player;

  return (
    <span 
      className={`
        inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg
        ${config.bg} ${config.text} ${className}
      `}
    >
      {showIcon && <span>{config.icon}</span>}
      <span className="capitalize">{role}</span>
    </span>
  );
}
