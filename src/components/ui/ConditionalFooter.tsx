"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/**
 * Conditionally renders the Footer only on public pages.
 * The /app/* routes have their own layout that handles the footer differently.
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  
  // Don't render footer on /app/* routes - they have their own layout
  if (pathname?.startsWith("/app")) {
    return null;
  }
  
  return <Footer />;
}
