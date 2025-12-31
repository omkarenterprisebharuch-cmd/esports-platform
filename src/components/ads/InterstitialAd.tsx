"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateSessionId, type ServedAd } from "@/lib/ads";

interface InterstitialAdProps {
  placementId: string;
  isOpen: boolean;
  onClose: () => void;
  skipDelay?: number; // Seconds before skip is available
  onAdComplete?: () => void;
}

export function InterstitialAd({
  placementId,
  isOpen,
  onClose,
  skipDelay = 5,
  onAdComplete,
}: InterstitialAdProps) {
  const [ad, setAd] = useState<ServedAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipCountdown, setSkipCountdown] = useState(skipDelay);
  const [canSkip, setCanSkip] = useState(false);
  const impressionStartTime = useRef<number>(0);
  const sessionId = useRef<string>("");

  useEffect(() => {
    if (isOpen) {
      sessionId.current = generateSessionId();
      fetchAd();
      setSkipCountdown(skipDelay);
      setCanSkip(false);
    }
  }, [isOpen, placementId, skipDelay]);

  // Skip countdown timer
  useEffect(() => {
    if (!isOpen || !ad) return;
    
    if (skipCountdown > 0) {
      const timer = setTimeout(() => {
        setSkipCountdown(skipCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanSkip(true);
    }
  }, [isOpen, ad, skipCountdown]);

  const fetchAd = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `/api/ads?placement=${placementId}&session=${sessionId.current}`
      );
      const data = await response.json();
      
      if (data.success && data.ad) {
        setAd(data.ad);
        impressionStartTime.current = Date.now();
        recordImpression(data.ad);
      } else {
        // No ad available, close immediately
        onClose();
      }
    } catch (err) {
      console.error("Failed to load interstitial ad:", err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const recordImpression = async (adData: ServedAd) => {
    try {
      await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "impression",
          adId: adData.adId,
          placementId,
          impressionToken: adData.impressionToken,
          sessionId: sessionId.current,
          pageUrl: window.location.href,
          viewabilityPercent: 100, // Full screen
        }),
      });
    } catch (err) {
      console.error("Failed to record impression:", err);
    }
  };

  const handleClick = useCallback(async () => {
    if (!ad) return;
    
    const timeToClick = Date.now() - impressionStartTime.current;
    
    try {
      await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "click",
          adId: ad.adId,
          placementId,
          sessionId: sessionId.current,
          pageUrl: window.location.href,
          destinationUrl: ad.destinationUrl,
          timeToClickMs: timeToClick,
        }),
      });
    } catch (err) {
      console.error("Failed to record click:", err);
    }
    
    window.open(ad.destinationUrl, "_blank", "noopener,noreferrer");
  }, [ad, placementId]);

  const handleSkip = () => {
    if (!canSkip) return;
    onAdComplete?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Skip button */}
      <div className="absolute top-4 right-4 z-10">
        {canSkip ? (
          <button
            onClick={handleSkip}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
          >
            Skip Ad
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="px-4 py-2 bg-gray-800 text-gray-400 text-sm rounded-lg">
            Skip in {skipCountdown}s
          </div>
        )}
      </div>

      {/* Ad label */}
      <div className="absolute top-4 left-4 z-10 px-2 py-1 bg-gray-800 text-gray-400 text-xs rounded">
        Advertisement
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      )}

      {/* Ad content */}
      {!loading && ad && (
        <div 
          className="relative max-w-2xl max-h-[80vh] w-full mx-4 cursor-pointer"
          onClick={handleClick}
        >
          {ad.adType === "video" && ad.videoUrl ? (
            <video
              src={ad.videoUrl}
              poster={ad.thumbnailUrl}
              className="w-full h-auto rounded-lg"
              autoPlay
              muted
              playsInline
              onEnded={() => setCanSkip(true)}
            />
          ) : ad.imageUrl ? (
            <img
              src={ad.imageUrl}
              alt={ad.title || ad.name}
              className="w-full h-auto rounded-lg"
            />
          ) : (
            <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-lg p-12 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">{ad.title || ad.name}</h2>
              {ad.description && (
                <p className="text-gray-300 text-lg mb-6">{ad.description}</p>
              )}
              <button className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors">
                {ad.ctaText}
              </button>
            </div>
          )}
          
          {/* CTA overlay for images */}
          {(ad.adType === "banner" || (ad.adType === "video" && !ad.videoUrl)) && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-lg transition-colors">
                {ad.ctaText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InterstitialAd;
