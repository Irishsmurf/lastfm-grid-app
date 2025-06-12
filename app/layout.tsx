import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://lastfm.paddez.com'),
  title: 'LastFM Album Collage Generator',
  description: 'Generate an image of your top albums!',
  openGraph: {
    type: 'website',
    siteName: 'LastFM Album Collage Generator',
    title: 'LastFM Album Collage Generator',
    description: 'Generate an image of your top albums!',
    url: '/',
    images: [
      {
        url: '/globe.svg', // Path relative to the public directory
        width: 800,
        height: 600,
        alt: 'LastFM Album Collage Generator',
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
        <meta name="application-name" content="LFM Grid" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LFM Grid" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        {/* Google tag (gtag.js) */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}></script>
        <script>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
          `}
        </script>
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          {children}
          <SpeedInsights />
          <Analytics />
          <footer>
            <a href="/about" style={{ marginRight: '10px' }}>
              About
            </a>
            <a href="/privacy.html" style={{ marginRight: '10px' }}>
              Privacy Policy
            </a>
            <a
              href="https://ko-fi.com/paddez"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginRight: '10px' }}
            >
              Support me on Ko-fi
            </a>
            <div className="copyright">
              © {new Date().getFullYear()} LastFM Album Collage Generator. All
              Rights Reserved.
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
