// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
} from 'firebase/remote-config';

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
remoteConfig.defaultConfig = {
  show_footer_feature_text: false, // Default value for our example feature
  shared_grid_expiry_days: 30, // Default expiry in days
  default_time_period: '1month', // Default time period
  lastfm_cache_expiry_seconds: 3600, // Default cache expiry in seconds
  not_found_cache_expiry_seconds: 86400, // Default not found cache expiry in seconds
  spotify_cache_expiry_seconds: 3600, // Default Spotify cache expiry in seconds
};

// Call this function when your app starts to fetch and activate the latest config
export const initializeRemoteConfig = async () => {
  try {
    await fetchAndActivate(remoteConfig);
  } catch (error) {
    console.error('Error initializing remote config:', error);
    // Handle error appropriately, perhaps by using default values or retrying
  }
};

// Generic function to get a config value by key
// It's up to the caller to handle type conversion if needed, or we can add it here
export const getRemoteConfigValue = (key: string) => {
  const value = getValue(remoteConfig, key);
  // getValue returns a RemoteConfigValue object. You need to convert it to the desired type.
  // Example: value.asString(), value.asNumber(), value.asBoolean()
  return value;
};

export { app, remoteConfig };
