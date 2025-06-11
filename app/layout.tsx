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
      <head>
        {/* TODO: User will add their Google AdSense script here, using next/script for optimal loading.
              The 'src' should include their publisher ID from an environment variable.
              Example:
              <Script
                async
                src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID}`}
                strategy="afterInteractive"
                crossOrigin="anonymous"
              />
        */}
      </head>
      <body
        className={`${inter.variable} ${montserrat.variable} antialiased`}
      >
        <ThemeProvider
          defaultTheme="system"
          storageKey="vite-ui-theme"
        >
          <div className="flex min-h-screen">
            {/* Left Ad Sidebar Placeholder */}
            <div id="left-ad-sidebar" className="fixed left-0 top-0 h-screen w-40 bg-gray-100 dark:bg-gray-800 p-2 shadow-md">
              {/* <!-- Google AdSense code for LEFT sidebar ad unit. Use process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID for data-ad-client and process.env.NEXT_PUBLIC_ADSENSE_LEFT_SLOT_ID for data-ad-slot --> */}
              <p className="text-sm text-gray-500">Left Ad Area</p> {/* Placeholder visible content */}
            </div>

            {/* Main Content Area */}
            <main id="main-content" className="flex-grow ml-40 mr-40 p-4 flex flex-col">
              <div className="flex-grow">
                {children}
              </div>
              <SpeedInsights />
              <Analytics />
              <footer>
                <a href="/privacy.html">Privacy Policy</a>
                <div className="copyright">
                  © {new Date().getFullYear()} LastFM Album Collage Generator. All Rights Reserved.
                </div>
              </footer>
            </main>

            {/* Right Ad Sidebar Placeholder */}
            <div id="right-ad-sidebar" className="fixed right-0 top-0 h-screen w-40 bg-gray-100 dark:bg-gray-800 p-2 shadow-md">
              {/* <!-- Google AdSense code for RIGHT sidebar ad unit. Use process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID for data-ad-client and process.env.NEXT_PUBLIC_ADSENSE_RIGHT_SLOT_ID for data-ad-slot --> */}
              <p className="text-sm text-gray-500">Right Ad Area</p> {/* Placeholder visible content */}
            </div>
          </div>
        </ThemeProvider>
        {/* Optional: Google AdSense script can also be placed here if not using next/script in Head */}
      </body>
    </html>
  );
}
