"use client";

/**
 * Cloudinary Image Optimization Utilities
 * 
 * Provides optimized image loading with:
 * - Auto-format (WebP/AVIF based on browser support)
 * - Auto-quality optimization
 * - Blur placeholder (LQIP - Low Quality Image Placeholder)
 * - Lazy loading with Intersection Observer
 * - Responsive image srcset generation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

// Cloudinary transformation options
interface TransformOptions {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "scale" | "thumb" | "crop";
  gravity?: "auto" | "face" | "center" | "north" | "south" | "east" | "west";
  quality?: "auto" | "auto:low" | "auto:eco" | "auto:good" | "auto:best" | number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  blur?: number;
  effect?: string;
}

// Standard responsive breakpoints
const RESPONSIVE_WIDTHS = [320, 480, 640, 768, 1024, 1280, 1536];

/**
 * Transform a Cloudinary URL with optimization parameters
 */
export function getOptimizedUrl(
  url: string | null | undefined,
  options: TransformOptions = {}
): string {
  if (!url) return "";
  
  // Check if it's a Cloudinary URL
  if (!url.includes("res.cloudinary.com")) {
    return url;
  }

  const {
    width,
    height,
    crop = "fill",
    gravity = "auto",
    quality = "auto",
    format = "auto",
    blur,
    effect,
  } = options;

  // Build transformation string
  const transforms: string[] = [];
  
  // Add format and quality first (most impactful)
  transforms.push(`f_${format}`);
  transforms.push(`q_${quality}`);
  
  // Add dimensions
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (width || height) {
    transforms.push(`c_${crop}`);
    transforms.push(`g_${gravity}`);
  }
  
  // Add effects
  if (blur) transforms.push(`e_blur:${blur}`);
  if (effect) transforms.push(`e_${effect}`);

  // Insert transformations into URL
  // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/[transforms]/public_id
  const transformString = transforms.join(",");
  
  // Find the /upload/ part and insert transforms after it
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return url;
  
  const beforeUpload = url.substring(0, uploadIndex + 8); // includes /upload/
  const afterUpload = url.substring(uploadIndex + 8);
  
  // Check if there are already transforms
  if (afterUpload.startsWith("v")) {
    // Has version, insert before it
    return `${beforeUpload}${transformString}/${afterUpload}`;
  } else if (afterUpload.includes("/")) {
    // Might have existing transforms, replace them
    const parts = afterUpload.split("/");
    const publicIdParts = parts.filter(p => !p.includes("_") && !p.startsWith("v"));
    return `${beforeUpload}${transformString}/${publicIdParts.join("/")}`;
  }
  
  return `${beforeUpload}${transformString}/${afterUpload}`;
}

/**
 * Generate blur placeholder URL (very low quality for LQIP)
 */
export function getBlurPlaceholderUrl(url: string | null | undefined): string {
  return getOptimizedUrl(url, {
    width: 20,
    height: 20,
    quality: "auto:low",
    blur: 1000,
    format: "auto",
  });
}

/**
 * Generate responsive srcSet for an image
 */
export function getResponsiveSrcSet(
  url: string | null | undefined,
  options: Omit<TransformOptions, "width"> = {}
): string {
  if (!url || !url.includes("res.cloudinary.com")) return "";
  
  return RESPONSIVE_WIDTHS
    .map(w => `${getOptimizedUrl(url, { ...options, width: w })} ${w}w`)
    .join(", ");
}

/**
 * Generate sizes attribute for responsive images
 */
export function getDefaultSizes(): string {
  return "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
}

// OptimizedImage component props
interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  crop?: TransformOptions["crop"];
  gravity?: TransformOptions["gravity"];
  quality?: TransformOptions["quality"];
  placeholder?: "blur" | "empty" | "skeleton";
  fallback?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized Image Component with:
 * - Auto-format and quality optimization
 * - Blur placeholder (LQIP)
 * - Lazy loading with Intersection Observer
 * - Responsive srcset
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
  fill = false,
  sizes = getDefaultSizes(),
  crop = "fill",
  gravity = "auto",
  quality = "auto",
  placeholder = "blur",
  fallback,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // Start loading 50px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Get optimized URLs
  const optimizedSrc = getOptimizedUrl(src, { width, height, crop, gravity, quality });
  const blurSrc = placeholder === "blur" ? getBlurPlaceholderUrl(src) : undefined;
  const srcSet = !width ? getResponsiveSrcSet(src, { crop, gravity, quality }) : undefined;

  // Fallback for missing or errored images
  if (!src || hasError) {
    if (fallback) {
      return (
        <img
          src={fallback}
          alt={alt}
          width={width}
          height={height}
          className={className}
        />
      );
    }
    
    // Default placeholder
    return (
      <div
        className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
        style={{ width: width || "100%", height: height || "100%" }}
      >
        <span className="text-gray-400 dark:text-gray-500 text-4xl">🎮</span>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = fill
    ? { position: "relative", width: "100%", height: "100%" }
    : {};

  const imageStyle: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, objectFit: "cover", width: "100%", height: "100%" }
    : {};

  return (
    <div style={containerStyle} className={fill ? className : undefined}>
      {/* Blur placeholder - shown while loading */}
      {placeholder === "blur" && blurSrc && !isLoaded && (
        <img
          src={blurSrc}
          alt=""
          aria-hidden="true"
          className={`${fill ? "absolute inset-0 w-full h-full object-cover" : ""} ${className} blur-lg scale-110`}
          style={!fill ? { width, height } : {}}
        />
      )}
      
      {/* Skeleton placeholder */}
      {placeholder === "skeleton" && !isLoaded && (
        <div
          className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${fill ? "absolute inset-0" : ""} ${className}`}
          style={!fill ? { width, height } : {}}
        />
      )}

      {/* Main image - only render src when in view */}
      <img
        ref={imgRef}
        src={isInView ? optimizedSrc : undefined}
        srcSet={isInView && srcSet ? srcSet : undefined}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`
          ${fill ? "" : className}
          ${!isLoaded ? "opacity-0" : "opacity-100"}
          transition-opacity duration-300
        `}
        style={{
          ...imageStyle,
          ...(isLoaded ? {} : { position: "absolute", opacity: 0 }),
        }}
      />
    </div>
  );
}

/**
 * Avatar component with Cloudinary optimization
 */
interface OptimizedAvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  fallbackInitial?: string;
}

export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className = "",
  fallbackInitial,
}: OptimizedAvatarProps) {
  const [hasError, setHasError] = useState(false);
  
  const optimizedSrc = getOptimizedUrl(src, {
    width: size * 2, // 2x for retina
    height: size * 2,
    crop: "fill",
    gravity: "face",
    quality: "auto",
  });

  if (!src || hasError) {
    // Use ui-avatars.com as fallback
    const initial = fallbackInitial || alt.charAt(0).toUpperCase();
    return (
      <img
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&size=${size * 2}&background=6366f1&color=fff`}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full ${className}`}
      />
    );
  }

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      className={`rounded-full object-cover ${className}`}
    />
  );
}

/**
 * Tournament Banner component with optimization
 */
interface OptimizedBannerProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function OptimizedBanner({
  src,
  alt,
  className = "",
  priority = false,
}: OptimizedBannerProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={1200}
      height={630}
      crop="fill"
      gravity="center"
      priority={priority}
      placeholder="blur"
      className={className}
      fallback="/tournament-placeholder.png"
    />
  );
}

export default OptimizedImage;
