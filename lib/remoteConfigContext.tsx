'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { remoteConfig } from './firebase';
import { fetchAndActivate, getAll } from 'firebase/remote-config';

// Define a type for your config values for type safety
export type AppConfig = {
  footer_feature_text: {
    enabled: boolean;
    text: string;
  };
  // Add other config keys here
};

// Create the context
const RemoteConfigContext = createContext<AppConfig | null>(null);

// Create the provider component
export function RemoteConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    // This function fetches, activates, and parses the config
    const initializeConfig = async () => {
      await fetchAndActivate(remoteConfig);

      // Get all values and parse them
      const allValues = getAll(remoteConfig);
      const newConfig: Partial<AppConfig> = {};

      try {
        const footerFeature = JSON.parse(
          allValues.footer_feature_text.asString()
        );
        newConfig.footer_feature_text = footerFeature;
      } catch (e) {
        console.error("Failed to parse 'footer_feature_text'", e);
      }

      // ... parse other values

      setConfig(newConfig as AppConfig);
    };

    initializeConfig();
  }, []);

  // We render children only after the config has been loaded to avoid flicker
  if (!config) {
    // Or you could return a global loading spinner here
    return null;
  }

  return (
    <RemoteConfigContext.Provider value={config}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

// Create a custom hook for easy access to the config
export const useRemoteConfig = () => {
  const context = useContext(RemoteConfigContext);
  if (!context) {
    throw new Error(
      'useRemoteConfig must be used within a RemoteConfigProvider'
    );
  }
  return context;
};
