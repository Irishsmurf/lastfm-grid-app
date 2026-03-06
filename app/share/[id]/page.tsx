import type { Metadata } from 'next';
import { redis } from '@/lib/redis';
import type { SharedGridData } from '@/lib/types';
import SharePageClient from './SharePageClient';

interface Props {
  params: Promise<{ id: string }>;
}

const PERIOD_LABELS: Record<string, string> = {
  '7day': 'Last Week',
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  overall: 'Overall',
};

async function getSharedGrid(id: string): Promise<SharedGridData | null> {
  try {
    const result = await redis.get(`share:${id}`);
    if (!result) return null;
    return JSON.parse(result) as SharedGridData;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getSharedGrid(id);

  if (!data) {
    return {
      title: 'Shared Album Grid | LastFM Album Collage Generator',
      description: 'View a shared LastFM album collage.',
    };
  }

  const periodLabel = PERIOD_LABELS[data.period] ?? data.period;
  const title = `${data.username}'s ${periodLabel} album grid`;
  const topAlbums = data.albums
    .slice(0, 5)
    .map((a) => `${a.name} by ${a.artist.name}`)
    .join(', ');
  const description = `Top albums: ${topAlbums}`;
  const url = `https://lastfm.paddez.com/share/${id}`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'LastFM Album Collage Generator',
      title,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function SharedGridPage() {
  return <SharePageClient />;
}
