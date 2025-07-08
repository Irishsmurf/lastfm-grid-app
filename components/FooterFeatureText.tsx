'use client';

import { useEffect, useState } from 'react';
import { remoteConfig } from '@/lib/firebase'; // Adjust path if necessary
import { fetchAndActivate, getValue } from 'firebase/remote-config';

const FooterFeatureText = () => {
  const [showText, setShowText] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const activateRemoteConfig = async () => {
      try {
        if (remoteConfig) {
          // In development, you might want to fetch more frequently.
          // The minimumFetchIntervalMillis is set in firebase.ts
          await fetchAndActivate(remoteConfig);
          const featureFlagValue = getValue(
            remoteConfig,
            'show_footer_feature_text'
          ).asBoolean();
          setShowText(featureFlagValue);
        } else {
          // Fallback if remoteConfig isn't initialized, though it should be.
          setShowText(false);
        }
      } catch (error) {
        console.error('Error fetching or activating Remote Config:', error);
        // Fallback to default or previously cached value if error occurs
        // For this example, we'll just ensure the text doesn't show on error.
        setShowText(false);
      } finally {
        setIsLoading(false);
      }
    };

    activateRemoteConfig();
  }, []);

  if (isLoading) {
    // Optional: render a loader or nothing while fetching
    return null;
  }

  if (showText) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '10px',
          backgroundColor: '#f0f0f0',
          color: '#333',
          borderTop: '1px solid #ddd',
        }}
      >
        Experimental Feature Active! (Toggled by Remote Config)
      </div>
    );
  }

  return null; // Don't render anything if the flag is false
};

export default FooterFeatureText;
