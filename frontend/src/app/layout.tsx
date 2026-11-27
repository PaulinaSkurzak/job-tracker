import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

// next/font downloads the fonts at build time and serves them from this app (no request to Google at runtime).
// The variable names match what shadcn's globals.css expects.
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Job Tracker", template: "%s · Job Tracker" },
  description: "Track co-op applications, contacts and resume match.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the "dark" class on <html> before React loads, which React would otherwise warn about.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
