// lib/metrics.ts
import { Registry, Counter, Histogram } from 'prom-client';

export const registry = new Registry();

export const apiRequestCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5],
  registers: [registry],
});

export const lastfmAlbumCount = new Counter({
  name: 'lastfm_album_count',
  help: 'Number of albums returned from the Last.fm API',
  labelNames: ['username', 'period'],
  registers: [registry],
});

export const spotifyLinkCount = new Counter({
  name: 'spotify_link_count',
  help: 'Number of Spotify links found for albums',
  labelNames: ['username', 'period'],
  registers: [registry],
});
