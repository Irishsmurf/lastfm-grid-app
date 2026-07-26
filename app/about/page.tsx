// app/about/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const TITLE = 'About Us | Gridify - Your Epic Last.fm Album Art Grid Generator';
const DESCRIPTION =
  "Ever stared at your Last.fm profile and thought, 'This needs more... grid?' We get it. Gridify is here to turn your scrobbled anthems into legendary album art mosaics!";

// Previously declared with `next/head`, which is a Pages Router API and a no-op in
// the App Router — so this page shipped with no title, description or social tags
// at all. The App Router equivalent is an exported metadata object.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: `${baseUrl}/about`,
    images: [`${baseUrl}/globe.svg`],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${baseUrl}/globe.svg`],
  },
};

// Static prose — no hooks, no interactivity, so it renders on the server and ships
// no JavaScript for itself.
export default function AboutPage() {
  return (
    <>
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-3xl mx-auto prose dark:prose-invert">
          <h1>So, You Wanna Know About Gridify?</h1>
          <p className="text-lg">
            Alright, settle in, music obsessive. You&apos;ve stumbled upon
            Gridify, the digital equivalent of meticulously arranging your
            vinyls, but for your Last.fm listening history. We&apos;re the folks
            who believe your top albums deserve to be flaunted, not just listed.
          </p>

          <h2>What&apos;s the Big Deal with Album Grids?</h2>
          <p>
            You know that feeling when your Last.fm chart perfectly reflects
            your impeccable taste? That weekly report that screams &quot;I have
            the best music library&quot;? We take that feeling and make it
            visual. An album grid is your personal music fingerprint, a mosaic
            of your most-played masterpieces, a testament to your dedication to
            the scrobble. It&apos;s proof you didn&apos;t just *listen* to
            music, you *lived* it.
          </p>
          <p>
            Whether you&apos;re a chart-topper connoisseur, a deep-cut diver, or
            just someone who really, *really* loves looking at album art,
            Gridify is your new best friend. We help you generate those awesome
            3x3 (or more, if we&apos;re feeling ambitious later) album cover
            grids that you&apos;ve seen floating around the music corners of the
            internet. Perfect for sharing, comparing, or just staring at
            lovingly.
          </p>

          <h2>Built for the Scrobble-Obsessed, By the Scrobble-Obsessed</h2>
          <p>
            We speak your language. &quot;Compatibility scores&quot;? Been
            there. &quot;Super-mega-ultra-rare artist discovery&quot;? We salute
            you. That slight panic when you listen to a guilty pleasure and hope
            it doesn&apos;t mess up your stats? We&apos;ve all felt it (or, you
            know, created a private session).
          </p>
          <p>
            Gridify is a passion project born from a love of music data and the
            vibrant Last.fm community. We wanted a simple, fun way to showcase
            those top albums and connect with fellow music nerds. So, go ahead,
            generate your grid, and wear your listening habits like a badge of
            honor!
          </p>

          <h2>Our Core Beliefs (Probably)</h2>
          <ul>
            <li>
              Life&apos;s too short for bad music (or un-gridded top albums).
            </li>
            <li>More scrobbles = more happiness. It&apos;s science.</li>
            <li>Album art is true art.</li>
            <li>If it&apos;s not on Last.fm, did it even happen?</li>
          </ul>

          <p className="mt-8">Ready to make your musical mark?</p>
          <p>
            <Link href="/" className="text-primary hover:underline">
              Let&apos;s Go Generate Some Grids!
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
