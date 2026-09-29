import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/nav/SiteHeader";

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
    <html lang="en">
      <body className="antialiased bg-background text-text-primary font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
