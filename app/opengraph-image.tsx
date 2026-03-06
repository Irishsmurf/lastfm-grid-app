import { ImageResponse } from 'next/og';

export const alt = 'LastFM Album Collage Generator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
          backgroundColor: '#000000',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            LastFM Album Collage
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#aaaaaa',
              textAlign: 'center',
            }}
          >
            Turn your Last.fm history into a shareable album art collage
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 20,
              color: '#d51007',
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
