import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/nav/SiteHeader";

// Fonts are bundled at build time and served from our own domain (no request
// to Google from visitors' browsers).
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "LiAIson — Your AI. Your Story. On Your Terms.",
  description: "Meet your personal AI representative. Share your story, be discovered, and connect meaningfully.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="antialiased bg-background text-text-primary font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
