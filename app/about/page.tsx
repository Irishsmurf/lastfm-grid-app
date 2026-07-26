// app/about/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-background py-14 px-4">
      <div className="max-w-[720px] mx-auto">
        <h1 className="text-4xl sm:text-5xl mb-5">
          So, You Wanna Know About This Thing?
        </h1>
        <p className="text-lg leading-relaxed">
          Settle in, music obsessive. You&apos;ve stumbled onto LastFM Album
          Collage, the digital equivalent of meticulously arranging your vinyls
          — but for your Last.fm listening history. Your top albums deserve to
          be flaunted, not just listed.
        </p>

        <hr className="hr" />

        <h2 className="text-2xl mb-3.5">
          What&apos;s the Big Deal with Album Grids?
        </h2>
        <p className="text-[15.5px] leading-relaxed text-foreground/85">
          You know that feeling when your Last.fm chart perfectly reflects your
          impeccable taste? An album grid is your personal music fingerprint — a
          mosaic of your most-played masterpieces. Proof you didn&apos;t just
          listen to music, you lived it.
        </p>
        <p className="text-[15.5px] leading-relaxed text-foreground/85">
          Chart-topper connoisseur, deep-cut diver, or just someone who loves
          staring at album art — this tool generates those 3×3 (or bigger) grids
          you&apos;ve seen floating around the music corners of the internet.
          Perfect for sharing, comparing, or just admiring.
        </p>

        <hr className="hr" />

        <h2 className="text-2xl mb-3.5">Built for the Scrobble-Obsessed</h2>
        <p className="text-[15.5px] leading-relaxed text-foreground/85">
          We speak your language. &quot;Compatibility scores&quot;? Been there.
          That slight panic when a guilty pleasure might mess up your stats?
          We&apos;ve all felt it.
        </p>
        <p className="text-[15.5px] leading-relaxed text-foreground/85">
          This is a passion project born from a love of music data and the
          Last.fm community — a simple, fun way to showcase your top albums and
          connect with fellow music nerds. Generate your grid and wear your
          listening habits like a badge of honor.
        </p>

        <hr className="hr" />

        <h2 className="text-2xl mb-3.5">Our Core Beliefs (Probably)</h2>
        <ul className="text-[15.5px] leading-loose pl-5 list-disc">
          <li>
            Life&apos;s too short for bad music, or un-gridded top albums.
          </li>
          <li>More scrobbles equals more happiness. It&apos;s science.</li>
          <li>Album art is true art.</li>
          <li>If it&apos;s not on Last.fm, did it even happen?</li>
        </ul>

        <div className="mt-10">
          <Button asChild>
            <Link href="/">Let&apos;s Go Generate Some Grids</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
