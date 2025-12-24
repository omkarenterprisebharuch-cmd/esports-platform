import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Esports Platform",
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
  ],
  authors: [{ name: "Esports Platform" }],
  openGraph: {
    title: "Esports Platform",
    description: "Organize and participate in esports tournaments",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
