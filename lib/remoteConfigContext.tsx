'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
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

// Define a default value for the config. This is crucial for the initial server render.
const defaultConfig: AppConfig = {
  footer_feature_text: {
    enabled: false,
    text: '',
  },
};

// Create the context with the default value. This prevents the build error.
const RemoteConfigContext = createContext<AppConfig>(defaultConfig);

// Create the provider component
export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    const initializeConfig = async () => {
      // It's good practice to set default values on the remote config instance itself
      remoteConfig.defaultConfig = {
        footer_feature_text: JSON.stringify(defaultConfig.footer_feature_text),
      };

      try {
        await fetchAndActivate(remoteConfig);

        const allValues = getAll(remoteConfig);
        const newConfig: Partial<AppConfig> = {};

        // Safely parse the value
        try {
          const footerFeature = JSON.parse(
            allValues.footer_feature_text.asString()
          );
          newConfig.footer_feature_text = footerFeature;
        } catch (e) {
          console.error(
            "Failed to parse 'footer_feature_text', using default.",
            e
          );
          newConfig.footer_feature_text = defaultConfig.footer_feature_text;
        }

        setConfig(newConfig as AppConfig);
      } catch (error) {
        console.error('Failed to fetch remote config, using default.', error);
      }
    };

    initializeConfig();
  }, []);

  return (
    <RemoteConfigContext.Provider value={config}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

// Update the hook. It no longer needs to throw an error because a default value is always available.
export const useRemoteConfig = () => {
  return useContext(RemoteConfigContext);
};
