"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import PWA components to avoid SSR issues
const InstallPrompt = dynamic(
  () => import("./InstallPrompt").then((mod) => mod.default),
  { ssr: false, loading: () => null }
);

const UpdateNotification = dynamic(
  () => import("./ServiceWorkerProvider").then((mod) => mod.UpdateNotification),
  { ssr: false, loading: () => null }
);

const OfflineIndicator = dynamic(
  () => import("./ServiceWorkerProvider").then((mod) => mod.OfflineIndicator),
  { ssr: false, loading: () => null }
);

export default function PWAProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <InstallPrompt />
        <UpdateNotification />
        <OfflineIndicator />
      </Suspense>
    </>
  );
}
