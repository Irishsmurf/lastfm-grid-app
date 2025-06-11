import React from 'react';
import Image from 'next/image'; // Import Next.js Image component
import SpotifyLinkButton from '../../../components/spotify-link-button'; // Import the new component

interface Album {
  name: string;
  artist: {
    name: string;
    mbid: string;
    url: string;
  };
  image: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
  }>;
  playcount?: number; // Optional, might be present
  url: string;
  mbid?: string;
}

interface SharedCollectionData {
  id: string;
  username: string;
  period: string;
  title: string;
  description?: string;
  albumsData: Album[]; // This is directly from Last.fm's topalbums.album
  createdAt: string;
}

async function fetchSharedCollection(collectionId: string): Promise<SharedCollectionData | null> {
  // Assuming NEXT_PUBLIC_APP_URL is set for absolute URLs,
  // otherwise, relative URLs work for server-side fetches within the same app.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const apiUrl = `${appUrl}/api/share/${collectionId}`;

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' }); // Ensure fresh data

    if (response.status === 404) {
      return null; // Collection not found
    }

    if (!response.ok) {
      // Log the error status and text for server-side debugging
      const errorText = await response.text();
      console.error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      // For the page, we might still treat this as "not found" or a generic error
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Network or fetch error for ${collectionId}:`, error);
    return null; // Network errors or other issues
  }
}

interface SharedCollectionPageProps {
  params: {
    collectionId: string;
  };
}

export default async function SharedCollectionPage({ params }: SharedCollectionPageProps) {
  const { collectionId } = params;
  const collection = await fetchSharedCollection(collectionId);

  if (!collection) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Collection Not Found</h1>
        <p>The shared collection you are looking for does not exist or could not be loaded.</p>
      </div>
    );
  }

  // Helper to get a specific image size, defaulting to large or the largest available
  const getImageUrl = (album: Album) => {
    const largeImage = album.image.find(img => img.size === 'large');
    if (largeImage && largeImage['#text']) return largeImage['#text'];
    const extralargeImage = album.image.find(img => img.size === 'extralarge');
    if (extralargeImage && extralargeImage['#text']) return extralargeImage['#text'];
    const mediumImage = album.image.find(img => img.size === 'medium');
    if (mediumImage && mediumImage['#text']) return mediumImage['#text'];
    // Fallback to any available image if specific sizes are not found
    const anyImage = album.image.find(img => img['#text']);
    return anyImage ? anyImage['#text'] : '/placeholder-image.png'; // Provide a fallback placeholder
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h1>{collection.title}</h1>
        {collection.description && <p style={{ color: '#555' }}>{collection.description}</p>}
        <p style={{ fontSize: '0.9em', color: '#777' }}>
          Shared by: <strong>{collection.username}</strong> | Period: <strong>{collection.period}</strong>
        </p>
        <p style={{ fontSize: '0.8em', color: '#999' }}>
          Created: {new Date(collection.createdAt).toLocaleDateString()}
        </p>
      </header>

      <section>
        <h2>Albums</h2>
        {collection.albumsData && collection.albumsData.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {collection.albumsData.map((album, index) => (
              <li key={album.mbid || `${album.name}-${album.artist.name}-${index}`} style={{ display: 'flex', marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <Image
                  src={getImageUrl(album)}
                  alt={`Cover art for ${album.name} by ${album.artist.name}`}
                  width={100}
                  height={100}
                  style={{ marginRight: '15px', objectFit: 'cover', borderRadius: '4px' }} // Keep existing styles, ensure objectFit is compatible
                />
                <div style={{ flexGrow: 1 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '5px' }}>{album.name}</h3>
                  <p style={{ margin: '0 0 10px', color: '#444' }}>{album.artist.name}</p>
                  <SpotifyLinkButton albumName={album.name} artistName={album.artist.name} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No albums found in this collection.</p>
        )}
      </section>
    </div>
  );
}
