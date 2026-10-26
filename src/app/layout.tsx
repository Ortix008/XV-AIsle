import type { Metadata } from "next";
import { Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import { connection } from "next/server";
import { shareCardMetadata } from "@/lib/share-card";
import { stripeTestMode } from "@/lib/server/stripe";
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

export function generateMetadata(): Metadata {
  return {
    title: "XV-AIsle",
    description:
      "XV-AIsle is a curated US market for home, kitchen and everyday goods. Every item is reviewed before it's listed.",
    ...shareCardMetadata(),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const testMode = stripeTestMode();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <noscript>
          <style>{".page-enter,[data-reveal]{animation:none !important;opacity:1 !important;transform:none !important;}"}</style>
        </noscript>
        {testMode ? (
          <p className="product-test" role="status">
            Test mode
          </p>
        ) : null}
        {children}
      </body>
    </html>
  );
}
