import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/contexts/ThemeContext";
import { PWAProvider } from "@/components/pwa";
// Analytics components disabled for local development due to webpack issues
// import { Analytics } from "@vercel/analytics/react";
// import { SpeedInsights } from "@vercel/speed-insights/next";
import { NavigationLoader } from "@/components/ui/Loader";
import ConditionalFooter from "@/components/ui/ConditionalFooter";
import { DevelopmentNotice } from "@/components/ui/DevelopmentNotice";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Nova Tourney",
  description:
    "A comprehensive platform for organizing, managing, and participating in esports tournaments",
  keywords: [
    "esports",
    "tournament",
    "gaming",
    "competitive",
    "freefire",
    "pubg",
    "valorant",
    "nova tourney",
  ],
  authors: [{ name: "Nova Tourney" }],
  openGraph: {
    title: "Nova Tourney",
    description: "Organize and participate in esports tournaments",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Esports",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <ThemeProvider>
            <PWAProvider>
              <div className="min-h-screen flex flex-col">
                <NavigationLoader />
                <main className="flex-1">
                  {children}
                </main>
                <ConditionalFooter />
                <DevelopmentNotice 
                  position="bottom-right"
                  autoDismissDelay={5000}
                  enabled={true}
                />
              </div>
            </PWAProvider>
          </ThemeProvider>
        </Providers>
        {/* Analytics disabled for local dev */}
        {/* <Analytics /> */}
        {/* <SpeedInsights /> */}
      </body>
    </html>
  );
}
