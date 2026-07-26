// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  getAll,
  isSupported,
} from 'firebase/remote-config';
import { logger } from '../utils/logger';
import { defaultRemoteConfig } from './remoteConfigDefaults';

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

// Only initialize Remote Config in browser environments — the SDK requires
// browser APIs (IndexedDB, fetch) and will throw in Node.js server contexts.
const remoteConfig =
  typeof window !== 'undefined' ? getRemoteConfig(app) : null;

if (remoteConfig) {
  remoteConfig.settings.minimumFetchIntervalMillis =
    process.env.NODE_ENV === 'development' ? 10000 : 43200000;
}

// Defaults live in their own Firebase-free module so consumers that only need the
// values don't pull the SDK in. Re-exported here for existing callers.
export { defaultRemoteConfig };

if (remoteConfig) {
  remoteConfig.defaultConfig = defaultRemoteConfig;
}

// Call this function when your app starts to fetch and activate the latest config
export const initializeRemoteConfig = async () => {
  if ((await isSupported()) == false) {
    logger.info(
      'RemoteConfig',
      'Remote Config is supported in this environment.'
    );
    return;
  }
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

    for (const [key, configValue] of Object.entries(allConfigValues)) {
      const defaultValue = (defaultRemoteConfig as Record<string, unknown>)[
        key
      ];
      const type = typeof defaultValue;

      // Attempt to infer type based on default values, otherwise default to string
      if (type === 'boolean') {
        loadedValues[key] = configValue.asBoolean();
      } else if (type === 'number') {
        loadedValues[key] = configValue.asNumber();
      } else {
        loadedValues[key] = configValue.asString();
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
