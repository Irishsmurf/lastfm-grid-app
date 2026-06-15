import { ImageResponse } from 'next/og';

export const alt = 'LastFM Album Collage Generator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND_RED = '#d51007';
const BRAND_DARK = '#0f0f0f';
const BRAND_SURFACE = '#1a1a1a';

const ACCENT_CELLS = new Set([2, 4, 6]);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BRAND_DARK,
          fontFamily: 'sans-serif',
          gap: 80,
          padding: 60,
        }}
      >
        {/* Brand logo grid */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((col) => {
                const idx = row * 3 + col;
                return (
                  <div
                    key={col}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      backgroundColor: ACCENT_CELLS.has(idx)
                        ? BRAND_RED
                        : BRAND_SURFACE,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.1,
            }}
          >
            LastFM Album Collage
          </div>
          <div style={{ fontSize: 26, color: '#aaaaaa', lineHeight: 1.4 }}>
            Turn your listening history into a shareable album art grid
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 20,
              color: BRAND_RED,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            lastfm.paddez.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
