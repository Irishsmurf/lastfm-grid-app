import { ImageResponse } from 'next/og';
import { redis } from '@/lib/redis';
import type { SharedGridData } from '@/lib/types';

export const runtime = 'nodejs';
export const alt = 'LastFM Album Grid';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND_RED = '#d51007';
const BRAND_DARK = '#0a0a0a';
const BRAND_SURFACE = '#1a1a1a';

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

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSharedGrid(id);

  // Fallback: branded static image when share not found
  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: BRAND_DARK,
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 700, color: '#ffffff' }}>
            LastFM Album Collage
          </div>
          <div style={{ fontSize: 28, color: '#aaaaaa', marginTop: 16 }}>
            Generate an image of your top albums
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 18,
              color: BRAND_RED,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            lastfm.paddez.com
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const periodLabel = PERIOD_LABELS[data.period] ?? data.period;
  const albums = data.albums.slice(0, 9);

  // Fetch album images as base64 to embed in ImageResponse
  const imageUrls = await Promise.all(
    albums.map(async (album) => {
      if (!album.imageUrl) return null;
      try {
        const res = await fetch(album.imageUrl);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
        const mime = res.headers.get('content-type') || 'image/jpeg';
        return `data:${mime};base64,${base64}`;
      } catch {
        return null;
      }
    })
  );

  // 3x3 grid of album arts, each 210x210, in a 630x630 block
  const CELL = 210;
  const GRID_SIZE = 630;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: BRAND_DARK,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left: 3x3 album grid */}
        <div
          style={{
            width: GRID_SIZE,
            height: GRID_SIZE,
            display: 'flex',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => {
            const imgSrc = imageUrls[i];
            return (
              <div
                key={i}
                style={{
                  width: CELL,
                  height: CELL,
                  backgroundColor: BRAND_SURFACE,
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    width={CELL}
                    height={CELL}
                    style={{ objectFit: 'cover' }}
                    alt=""
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Right: info panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 40px',
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: BRAND_RED,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            LastFM Album Collage
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
            }}
          >
            {data.username}&apos;s album grid
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#aaaaaa',
            }}
          >
            {periodLabel}
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {albums.slice(0, 5).map((album, i) => (
              <div
                key={i}
                style={{
                  fontSize: 14,
                  color: '#888888',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {album.name} — {album.artist.name}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#ffffff',
              }}
            >
              Create yours at lastfm.paddez.com
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#888888',
              }}
            >
              Free · No account required
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
