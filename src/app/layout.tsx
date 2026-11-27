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
  display: "optional",
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
  display: "optional",
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
  display: "optional",
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
  const displayFamily = xvDisplay.style.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-fonts={`${xvInter.variable} ${xvDisplay.variable} ${xvMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* @ts-expect-error Impact site verification reads value, which the Metadata API rewrites to content. */}
        <meta name="impact-site-verification" value="c47e4b0e-da1e-4c09-9425-6f14cfd7fc4e" />
        <script
          dangerouslySetInnerHTML={{
            // Check once, before first paint. Chromium reports check() as false until
            // the face is loaded into this document, even when the woff2 is in the HTTP
            // cache, so a same-origin mark (xvaisle-brand-font-v2) is also read here.
            // The mark is written only after every heading weight (500, 600, 700) passes
            // document.fonts.check. Older keys are ignored and removed. brand-font is
            // never added later on this visit. If a check fails after fonts.ready, the
            // mark is deleted and the current page's class is left alone.
            __html: `(function(){var root=document.documentElement;var family=${JSON.stringify(displayFamily)};var key="xvaisle-brand-font-v2";var weights=["500","600","700"];var oldKeys=["xvaisle-brand-font","xvaisle-brand-font-v1"];function spec(w){return w+" 16px "+family;}function hasFaces(){if(!document.fonts)return false;try{for(var i=0;i<weights.length;i++){if(!document.fonts.check(spec(weights[i])))return false;}return true;}catch(e){return false;}}try{for(var i=0;i<oldKeys.length;i++)localStorage.removeItem(oldKeys[i]);}catch(e){}var ready=false,cached=false;try{ready=hasFaces();}catch(e){}try{cached=localStorage.getItem(key)==="1";}catch(e){}if(ready||cached){root.classList.add("brand-font");var fonts=root.getAttribute("data-fonts")||"";if(fonts&&root.className.indexOf(fonts)<0)root.className+=" "+fonts;}if(ready){try{localStorage.setItem(key,"1");}catch(e){}}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var root=document.documentElement;var family=${JSON.stringify(displayFamily)};var fonts=root.getAttribute("data-fonts")||"";var key="xvaisle-brand-font-v2";var weights=["500","600","700"];var oldKeys=["xvaisle-brand-font","xvaisle-brand-font-v1"];function spec(w){return w+" 16px "+family;}function apply(){if(fonts&&root.className.indexOf(fonts)<0)root.className+=" "+fonts;}function hasFaces(){if(!document.fonts)return false;try{for(var i=0;i<weights.length;i++){if(!document.fonts.check(spec(weights[i])))return false;}return true;}catch(e){return false;}}function mark(){try{if(hasFaces())localStorage.setItem(key,"1");}catch(e){}}function dropMark(){try{if(!hasFaces()){localStorage.removeItem(key);for(var i=0;i<oldKeys.length;i++)localStorage.removeItem(oldKeys[i]);}}catch(e){}}function loadAll(){return Promise.all(weights.map(function(w){return document.fonts.load(spec(w));}));}function after(){apply();try{var done=function(){if(hasFaces())mark();else dropMark();};loadAll().then(done,done);if(document.fonts.ready)document.fonts.ready.then(function(){loadAll().then(done,done);},dropMark);}catch(e){dropMark();}}if(location.pathname!=="/"){after();return;}function arm(){var img=document.querySelector(".hero-aisle-photo");if(!img){after();return;}function go(){var paint=function(){requestAnimationFrame(function(){requestAnimationFrame(after);});};if(img.decode)img.decode().then(paint,paint);else paint();}if(img.complete&&img.naturalWidth)go();else{img.addEventListener("load",go,{once:true});img.addEventListener("error",after,{once:true});}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",arm);else arm();})();`,
          }}
        />
        <noscript>
          <style>{".page-enter,[data-reveal]{animation:none !important;opacity:1 !important;transform:none !important;}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
