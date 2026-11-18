import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { connection } from "next/server";
import { shareCardMetadata } from "@/lib/share-card";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
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
