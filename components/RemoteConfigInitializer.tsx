"use client";

import { useEffect } from 'react';
import { initializeRemoteConfig } from '@/lib/firebase';

export default function RemoteConfigInitializer() {
  useEffect(() => {
    // Initialize Remote Config using the centralized function from lib/firebase.ts
    // This will also handle fetching and activating, and setting defaults defined in the lib.
    initializeRemoteConfig().catch(error => {
      // Log error to console for visibility during development/debugging
      // The logger from lib/firebase.ts might also catch this if initializeRemoteConfig uses it internally for its own errors.
      console.error("Failed to initialize Remote Config from RemoteConfigInitializer:", error);
    });
  }, []); // Empty dependency array ensures this runs only once on mount

  return null; // This component does not render anything visible
}
