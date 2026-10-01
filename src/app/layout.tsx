import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "XV-AIsle",
  description:
    "Sell approved products without holding the box. Buyers pay on xvaisle.com. The first 30 days are free, then $10 a month.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var q=new URLSearchParams(location.search).get("theme");var s=localStorage.getItem("xvaisle-theme");var t=(q==="light"||q==="dark")?q:(s==="light"||s==="dark"?s:"dark");document.documentElement.dataset.theme=t;}catch(e){}})();',
          }}
        />
        {children}
      </body>
    </html>
  );
}
