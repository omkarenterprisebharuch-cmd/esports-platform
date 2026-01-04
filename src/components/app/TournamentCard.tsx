"use client";

import React from "react";
import Link from "next/link";
import { GameBadge, StatusBadge } from "./Badges";

interface TournamentCardProps {
  id: number | string;
  name: string;
  gameType: string;
  tournamentType: string;
  prizePool: number;
  entryFee: number;
  startDate: string | Date;
  status: string;
  maxTeams: number;
  registeredCount: number;
  hostName?: string;
  isRegistered?: boolean;
  recommendation?: string;
  variant?: "default" | "compact" | "featured";
  className?: string;
}

export function TournamentCard({
  id,
  name,
  gameType,
  tournamentType,
  prizePool,
  entryFee,
  startDate,
  status,
  maxTeams,
  registeredCount,
  hostName,
  isRegistered = false,
  recommendation,
  variant = "default",
  className = "",
}: TournamentCardProps) {
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const slotsPercentage = (registeredCount / maxTeams) * 100;
  const isAlmostFull = slotsPercentage >= 80;
  const isFull = registeredCount >= maxTeams;

  if (variant === "compact") {
    return (
      <Link
        href={`/app/tournament/${id}`}
        className={`
          flex items-center gap-4 p-4 rounded-xl
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
          hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600
          transition-all duration-200
          ${className}
        `}
      >
        <GameBadge game={gameType} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
            {name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(startDate)} • {tournamentType.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-orange-600 dark:text-orange-400">
            ₹{prizePool.toLocaleString()}
          </p>
          <StatusBadge status={status} size="sm" />
        </div>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link
        href={`/app/tournament/${id}`}
        className={`
          group relative overflow-hidden rounded-2xl
          bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
          hover:shadow-xl transition-all duration-300
          ${className}
        `}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="relative p-6">
          {recommendation && (
            <span className="inline-block px-3 py-1 text-xs font-medium text-orange-400 bg-orange-500/20 rounded-full mb-4">
              {recommendation}
            </span>
          )}
          
          <div className="flex items-start justify-between mb-4">
            <GameBadge game={gameType} size="lg" />
            <StatusBadge status={status} />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
            {name}
          </h3>
          
          <div className="space-y-2 text-sm text-gray-400 mb-4">
            <div className="flex items-center gap-2">
              <span>🏆</span>
              <span className="text-white font-semibold">₹{prizePool.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📅</span>
              <span>{formatDate(startDate)}</span>
            </div>
          </div>
          
          {/* Slots progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">
                {registeredCount}/{maxTeams} slots
              </span>
              {isAlmostFull && !isFull && (
                <span className="text-orange-400 font-medium">Filling up fast!</span>
              )}
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  isFull ? "bg-red-500" : isAlmostFull ? "bg-orange-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(slotsPercentage, 100)}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Entry: {entryFee === 0 ? "Free" : `₹${entryFee}`}
            </span>
            <span className="text-orange-400 font-medium text-sm group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              View Details
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link
      href={`/app/tournament/${id}`}
      className={`
        group block rounded-2xl overflow-hidden
        bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-600
        transition-all duration-200
        ${className}
      `}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <GameBadge game={gameType} size="lg" />
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={status} />
            {isRegistered && (
              <span className="px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full">
                ✓ Registered
              </span>
            )}
          </div>
        </div>
        
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2">
          {name}
        </h3>
        
        {recommendation && (
          <p className="text-sm text-orange-600 dark:text-orange-400 mb-2 font-medium">
            {recommendation}
          </p>
        )}
        
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <span>🏆</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ₹{prizePool.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>{formatDate(startDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span>{tournamentType.toUpperCase()} • {registeredCount}/{maxTeams} slots</span>
          </div>
          {hostName && (
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span>by {hostName}</span>
            </div>
          )}
        </div>
        
        {/* Slots progress bar */}
        <div className="mb-4">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                isFull ? "bg-red-500" : isAlmostFull ? "bg-orange-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(slotsPercentage, 100)}%` }}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Entry: {entryFee === 0 ? (
              <span className="text-green-600 dark:text-green-400">Free</span>
            ) : (
              <span>₹{entryFee}</span>
            )}
          </span>
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
            View Details
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
