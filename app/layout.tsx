import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
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
        className={`${inter.variable} ${montserrat.variable} antialiased`}
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
            <a href="https://ko-fi.com/YOUR_KOFI_USERNAME" target="_blank" rel="noopener noreferrer" style={{ marginRight: '10px' }}>Support me on Ko-fi</a>
            <div className="copyright">
              © {new Date().getFullYear()} LastFM Album Collage Generator. All Rights Reserved.
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
