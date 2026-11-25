import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import { shareCardMetadata } from "@/lib/share-card";
import "./globals.css";

const xvInter = localFont({
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
  declarations: [
    { prop: "ascent-override", value: "96.88%" },
    { prop: "descent-override", value: "24.12%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

const xvDisplay = localFont({
  src: [
    { path: "./fonts/space-grotesk-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "ascent-override", value: "98.40%" },
    { prop: "descent-override", value: "29.20%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

const xvMono = localFont({
  src: "./fonts/geist-mono-latin-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  declarations: [
    { prop: "ascent-override", value: "100.50%" },
    { prop: "descent-override", value: "29.50%" },
    { prop: "line-gap-override", value: "0%" },
  ],
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
      className="h-full antialiased"
      data-fonts={`${xvInter.variable} ${xvDisplay.variable} ${xvMono.variable}`}
    >
      <head>
        {/* @ts-expect-error Impact site verification reads value, which the Metadata API rewrites to content. */}
        <meta name="impact-site-verification" value="c47e4b0e-da1e-4c09-9425-6f14cfd7fc4e" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var root=document.documentElement;var fonts=root.getAttribute('data-fonts')||'';function apply(){if(fonts)root.className+=' '+fonts;var n=document.querySelector('.vm');if(n)n.style.contentVisibility='visible';}if(location.pathname!=='/'){apply();return;}function arm(){var img=document.querySelector('.hero-aisle-photo');if(!img){apply();return;}function go(){var paint=function(){requestAnimationFrame(function(){requestAnimationFrame(apply);});};if(img.decode)img.decode().then(paint,paint);else paint();}if(img.complete&&img.naturalWidth)go();else{img.addEventListener('load',go,{once:true});img.addEventListener('error',apply,{once:true});}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm);else arm();})();",
          }}
        />
        <noscript>
          <style>{".page-enter,[data-reveal]{animation:none !important;opacity:1 !important;transform:none !important;}.vm{content-visibility:visible;}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
