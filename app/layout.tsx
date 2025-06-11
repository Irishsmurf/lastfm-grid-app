import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/theme-provider";

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
  metadataBase: new URL("https://lastfm.paddez.com"),
  title: "LastFM Album Collage Generator",
  description: "Generate an image of your top albums!",
  openGraph: {
    type: "website",
    siteName: "LastFM Album Collage Generator",
    title: "LastFM Album Collage Generator",
    description: "Generate an image of your top albums!",
    url: "/",
    images: [
      {
        url: "/globe.svg", // Path relative to the public directory
        width: 800,
        height: 600,
        alt: "LastFM Album Collage Generator",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          defaultTheme="system"
          storageKey="vite-ui-theme"
        >
          {children}
          <SpeedInsights />
          <Analytics />
          <footer>
            <a href="/privacy.html">Privacy Policy</a>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
