// lib/metrics.ts
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

// Use a global symbol to store the registry, ensuring it's a singleton
const globalForRegistry = global as unknown as {
  registry: Registry | undefined;
};

// Create a new registry only if one doesn't already exist
export const registry = globalForRegistry.registry || new Registry();

// If we just created the registry, register the default metrics
if (!globalForRegistry.registry) {
  collectDefaultMetrics({ register: registry });
}

// Store the registry in the global object so it can be reused
globalForRegistry.registry = registry;

export const apiRequestCounter =
  registry.getSingleMetric('api_requests_total') ||
  new Counter({
    name: 'api_requests_total',
    help: 'Total number of API requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });

export const apiRequestDuration =
  registry.getSingleMetric('api_request_duration_seconds') ||
  new Histogram({
    name: 'api_request_duration_seconds',
    help: 'Duration of API requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 5],
    registers: [registry],
  });

export const lastfmAlbumCount =
  registry.getSingleMetric('lastfm_album_count') ||
  new Counter({
    name: 'lastfm_album_count',
    help: 'Number of albums returned from the Last.fm API',
    labelNames: ['username', 'period'],
    registers: [registry],
  });

export const spotifyLinkCount =
  registry.getSingleMetric('spotify_link_count') ||
  new Counter({
    name: 'spotify_link_count',
    help: 'Number of Spotify links found for albums',
    labelNames: ['username', 'period'],
    registers: [registry],
  });
