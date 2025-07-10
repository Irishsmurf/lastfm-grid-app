import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

const globalForRegistry = global as unknown as {
  registry: Registry | undefined;
  apiRequestCounter: Counter | undefined;
  apiRequestDuration: Histogram | undefined;
  lastfmAlbumCount: Counter | undefined;
  spotifyLinkCount: Counter | undefined;
};

function getOrCreateRegistry(): Registry {
  if (globalForRegistry.registry) {
    return globalForRegistry.registry;
  }
  const newRegistry = new Registry();
  collectDefaultMetrics({ register: newRegistry });
  globalForRegistry.registry = newRegistry;
  return newRegistry;
}

export const registry = getOrCreateRegistry();

function getOrCreateCounter(
  name: string,
  help: string,
  labelNames: string[]
): Counter {
  const existingMetric = registry.getSingleMetric(name);
  if (existingMetric) {
    return existingMetric as Counter;
  }
  const newCounter = new Counter({
    name,
    help,
    labelNames,
    registers: [registry],
  });
  return newCounter;
}

function getOrCreateHistogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[]
): Histogram {
  const existingMetric = registry.getSingleMetric(name);
  if (existingMetric) {
    return existingMetric as Histogram;
  }
  const newHistogram = new Histogram({
    name,
    help,
    labelNames,
    buckets,
    registers: [registry],
  });
  return newHistogram;
}

export const apiRequestCounter = getOrCreateCounter(
  'api_requests_total',
  'Total number of API requests',
  ['method', 'route', 'status_code']
);

export const apiRequestDuration = getOrCreateHistogram(
  'api_request_duration_seconds',
  'Duration of API requests in seconds',
  ['method', 'route'],
  [0.1, 0.5, 1, 1.5, 2, 5]
);

export const lastfmAlbumCount = getOrCreateCounter(
  'lastfm_album_count',
  'Number of albums returned from the Last.fm API',
  ['username', 'period']
);

export const spotifyLinkCount = getOrCreateCounter(
  'spotify_link_count',
  'Number of Spotify links found for albums',
  ['username', 'period']
);
