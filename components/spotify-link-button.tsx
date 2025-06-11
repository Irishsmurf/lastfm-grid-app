"use client";

import React, { useState } from 'react';

interface SpotifyLinkButtonProps {
  albumName: string;
  artistName: string;
}

const SpotifyLinkButton: React.FC<SpotifyLinkButtonProps> = ({ albumName, artistName }) => {
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpotifyLink = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spotify-link?albumName=${encodeURIComponent(albumName)}&artistName=${encodeURIComponent(artistName)}`);

      if (response.ok) {
        const data = await response.json();
        if (data.spotifyUrl) {
          setSpotifyUrl(data.spotifyUrl);
        } else {
          setError("Album not found on Spotify.");
          // Keep spotifyUrl as null
        }
      } else {
        // Handle non-2xx responses (e.g., 500 from our API)
        const errorData = await response.json();
        setError(errorData.message || "Could not fetch Spotify link. Please try again.");
      }
    } catch (e) {
      // Handle network errors or other fetch-related issues
      console.error("Fetch Spotify link error:", e);
      setError("Failed to connect. Please check your network and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (spotifyUrl) {
    return (
      <a
        href={spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '8px 12px',
          backgroundColor: '#1DB954', // Spotify green
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontWeight: 'bold',
        }}
      >
        Open on Spotify
      </a>
    );
  }

  return (
    <div>
      <button
        onClick={fetchSpotifyLink}
        disabled={isLoading}
        style={{
          padding: '8px 12px',
          backgroundColor: isLoading ? '#ccc' : '#007bff', // Grey when loading, blue otherwise
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          marginRight: error ? '10px' : '0', // Add some space if error is shown
        }}
      >
        {isLoading ? 'Loading...' : 'Get Spotify Link'}
      </button>
      {error && <span style={{ color: 'red', fontSize: '0.9em', marginLeft: '10px' }}>{error}</span>}
    </div>
  );
};

export default SpotifyLinkButton;
