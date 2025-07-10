// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  getAll,
} from 'firebase/remote-config';
import { logger } from '../utils/logger';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app;
try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw new Error(
    'Failed to initialize Firebase app. Please check your configuration.'
  );
}

const remoteConfig = getRemoteConfig(app);

// Set a minimum fetch interval for development (e.g., 10 seconds)
// In production, this should be much higher (e.g., 12 hours = 43200000 ms)
if (process.env.NODE_ENV === 'development') {
  remoteConfig.settings.minimumFetchIntervalMillis = 10000; // 10 seconds
} else {
  remoteConfig.settings.minimumFetchIntervalMillis = 43200000; // 12 hours
}

// Set default values (optional, but recommended)
export const defaultRemoteConfig = {
  show_footer_feature_text: false, // Default value for our example feature
  shared_grid_expiry_days: 30, // Default expiry in days
  default_time_period: '1month', // Default time period
  lastfm_cache_expiry_seconds: 3600, // Default cache expiry in seconds
  not_found_cache_expiry_seconds: 86400, // Default not found cache expiry in seconds
  spotify_cache_expiry_seconds: 3600, // Default Spotify cache expiry in seconds
  // FTUE Defaults
  ftue_enabled: true,
  welcome_message_variant: 'short_intro', // "none", "short_intro", "detailed_guide"
  welcome_message_text_short:
    'Welcome to Gridify! Generate your Last.fm album grid below.',
  welcome_message_text_detailed:
    "Get started with Gridify in 3 simple steps: 1. Enter your Last.fm username. 2. Choose a time period. 3. Click 'Generate Grid'!",
  highlight_initial_action: 'username_input', // "none", "username_input", "generate_button"
  prefill_example_username: false,
  example_username_value: 'musiclover123',
};
remoteConfig.defaultConfig = defaultRemoteConfig;

// Call this function when your app starts to fetch and activate the latest config
export const initializeRemoteConfig = async () => {
  if (!remoteConfig) {
    logger.info(
      'RemoteConfig',
      'Skipping initialization, remoteConfig is not set.'
    );
    return;
  }

  logger.info('RemoteConfig', 'Initializing Remote Config...');
  try {
    await fetchAndActivate(remoteConfig);
    logger.info(
      'RemoteConfig',
      'Successfully fetched and activated Remote Config.'
    );

    const allConfigValues = getAll(remoteConfig);
    const loadedValues: Record<string, string | number | boolean> = {};
    for (const key in allConfigValues) {
      // Attempt to infer type based on default values, otherwise default to string
      if (
        typeof defaultRemoteConfig[key as keyof typeof defaultRemoteConfig] ===
        'boolean'
      ) {
        loadedValues[key] = allConfigValues[key].asBoolean();
      } else if (
        typeof defaultRemoteConfig[key as keyof typeof defaultRemoteConfig] ===
        'number'
      ) {
        loadedValues[key] = allConfigValues[key].asNumber();
      } else {
        loadedValues[key] = allConfigValues[key].asString();
      }
    }
    logger.info(
      'RemoteConfig',
      `Loaded values: ${JSON.stringify(loadedValues)}`
    );
  } catch (error) {
    logger.error(
      'RemoteConfig',
      `Error initializing Remote Config: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error('Error initializing remote config:', error);
  }
};

export const getRemoteConfigValue = (key: string) => {
  if (!remoteConfig) {
    const defaultValue =
      defaultRemoteConfig[key as keyof typeof defaultRemoteConfig];
    return {
      asString: () => String(defaultValue),
      asNumber: () => Number(defaultValue),
      asBoolean: () => Boolean(defaultValue),
      _source: 'default',
    };
  }
  return getValue(remoteConfig, key);
};

export { app, remoteConfig };
