import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import { shareCardMetadata } from "@/lib/share-card";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

const spaceGrotesk = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

/** Hero h1 is Space Grotesk 700. This is the only preloaded face. */
const spaceGroteskHero = localFont({
  src: "./fonts/space-grotesk-latin-700.woff2",
  weight: "700",
  style: "normal",
  variable: "--font-display-hero",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
});

const SITE_DESCRIPTION = "XV-AIsle gathers home, kitchen and everyday picks, each linking to the store where you buy it.";

export function generateMetadata(): Metadata {
  const share = shareCardMetadata();
  return {
    title: "XV-AIsle",
    description: SITE_DESCRIPTION,
    ...share,
    openGraph: { ...share.openGraph, description: SITE_DESCRIPTION },
    twitter: { ...share.twitter, description: SITE_DESCRIPTION },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${spaceGroteskHero.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* @ts-expect-error Impact site verification reads value, which the Metadata API rewrites to content. */}
        <meta name="impact-site-verification" value="c47e4b0e-da1e-4c09-9425-6f14cfd7fc4e" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <noscript>
          <style>{".page-enter,[data-reveal]{animation:none !important;opacity:1 !important;transform:none !important;}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
