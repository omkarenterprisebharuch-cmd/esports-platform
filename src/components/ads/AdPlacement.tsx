"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateSessionId, type ServedAd, AD_PLACEMENTS } from "@/lib/ads";

interface AdPlacementProps {
  placementId: string;
  className?: string;
  fallback?: React.ReactNode;
  onAdLoaded?: (ad: ServedAd) => void;
  onAdClick?: (ad: ServedAd) => void;
  onError?: (error: string) => void;
}

export function AdPlacement({
  placementId,
  className = "",
  fallback = null,
  onAdLoaded,
  onAdClick,
  onError,
}: AdPlacementProps) {
  const [ad, setAd] = useState<ServedAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impressionRecorded, setImpressionRecorded] = useState(false);
  const adRef = useRef<HTMLDivElement>(null);
  const impressionStartTime = useRef<number>(0);
  const sessionId = useRef<string>("");

  // Get placement config
  const placement = AD_PLACEMENTS[placementId];

  // Fetch ad on mount
  useEffect(() => {
    sessionId.current = generateSessionId();
    fetchAd();
  }, [placementId]);

  const fetchAd = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/ads?placement=${placementId}&session=${sessionId.current}`
      );
      const data = await response.json();
      
      if (data.success && data.ad) {
        setAd(data.ad);
        impressionStartTime.current = Date.now();
        onAdLoaded?.(data.ad);
      } else {
        setAd(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load ad";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  // Track impression when ad becomes visible
  useEffect(() => {
    if (!ad || impressionRecorded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            recordImpression();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => observer.disconnect();
  }, [ad, impressionRecorded]);

  const recordImpression = useCallback(async () => {
    if (!ad || impressionRecorded) return;
    
    setImpressionRecorded(true);
    
    try {
      await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "impression",
          adId: ad.adId,
          placementId,
          impressionToken: ad.impressionToken,
          sessionId: sessionId.current,
          pageUrl: window.location.href,
          viewabilityPercent: 50,
        }),
      });
    } catch (err) {
      console.error("Failed to record impression:", err);
    }
  }, [ad, placementId, impressionRecorded]);

  const handleClick = useCallback(async () => {
    if (!ad) return;
    
    const timeToClick = Date.now() - impressionStartTime.current;
    
    // Record click
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

    onAdClick?.(ad);
    
    // Open destination URL
    window.open(ad.destinationUrl, "_blank", "noopener,noreferrer");
  }, [ad, placementId, onAdClick]);

  // Record view duration on unmount
  useEffect(() => {
    return () => {
      if (ad && impressionRecorded && impressionStartTime.current) {
        const viewDuration = Date.now() - impressionStartTime.current;
        
        // Fire and forget - update impression with view duration
        fetch("/api/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "impression",
            adId: ad.adId,
            placementId,
            sessionId: sessionId.current,
            viewDurationMs: viewDuration,
          }),
        }).catch(() => {});
      }
    };
  }, [ad, placementId, impressionRecorded]);

  if (loading) {
    return (
      <div 
        className={`animate-pulse bg-gray-800 rounded ${className}`}
        style={{ 
          width: placement?.width || "100%", 
          height: placement?.height || 90 
        }}
      />
    );
  }

  if (error || !ad) {
    return <>{fallback}</>;
  }

  return (
    <div
      ref={adRef}
      className={`relative cursor-pointer group ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`Advertisement: ${ad.title || ad.name}`}
    >
      {ad.adType === "banner" && (
        <BannerAdContent ad={ad} placement={placement} />
      )}
      {ad.adType === "native" && (
        <NativeAdContent ad={ad} />
      )}
      {ad.adType === "video" && (
        <VideoAdContent ad={ad} placement={placement} />
      )}
      
      {/* Ad label */}
      <div className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/50 text-gray-400 rounded">
        Ad
      </div>
    </div>
  );
}

// Banner ad content
function BannerAdContent({ ad, placement }: { ad: ServedAd; placement?: typeof AD_PLACEMENTS[string] }) {
  return (
    <div 
      className="relative overflow-hidden rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
      style={{ 
        width: placement?.width || "100%", 
        height: placement?.height || 90 
      }}
    >
      {ad.imageUrl ? (
        <img
          src={ad.imageUrl}
          alt={ad.title || ad.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-purple-900 to-blue-900 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-white font-semibold text-sm">{ad.title || ad.name}</p>
            {ad.description && (
              <p className="text-gray-300 text-xs mt-1 line-clamp-2">{ad.description}</p>
            )}
          </div>
        </div>
      )}
      
      {/* CTA overlay on hover */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg">
          {ad.ctaText}
        </span>
      </div>
    </div>
  );
}

// Native ad content (looks like content)
function NativeAdContent({ ad }: { ad: ServedAd }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex gap-4">
        {ad.thumbnailUrl && (
          <img
            src={ad.thumbnailUrl}
            alt=""
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm line-clamp-2">{ad.title || ad.name}</h4>
          {ad.description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{ad.description}</p>
          )}
          <span className="inline-block mt-2 text-orange-400 text-xs font-medium">
            {ad.ctaText} →
          </span>
        </div>
      </div>
    </div>
  );
}

// Video ad content
function VideoAdContent({ ad, placement }: { ad: ServedAd; placement?: typeof AD_PLACEMENTS[string] }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div 
      className="relative overflow-hidden rounded-lg border border-gray-700"
      style={{ 
        width: placement?.width || "100%", 
        height: placement?.height || 250 
      }}
    >
      {ad.videoUrl ? (
        <>
          <video
            ref={videoRef}
            src={ad.videoUrl}
            poster={ad.thumbnailUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
            onEnded={() => setIsPlaying(false)}
          />
          {!isPlaying && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handlePlayClick();
              }}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          )}
        </>
      ) : ad.thumbnailUrl ? (
        <img
          src={ad.thumbnailUrl}
          alt={ad.title || ad.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <span className="text-gray-500">Video Ad</span>
        </div>
      )}
    </div>
  );
}

export default AdPlacement;
