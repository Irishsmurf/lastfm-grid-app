import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpotifyLinkButton from './spotify-link-button'; // Adjust path as necessary

// Mock global.fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SpotifyLinkButton', () => {
  const albumName = 'Test Album';
  const artistName = 'Test Artist';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders initial button state', () => {
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);
    expect(screen.getByRole('button', { name: /get spotify link/i })).toBeInTheDocument();
  });

  test('clicking button shows loading state and calls fetch', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ spotifyUrl: null }) }); // Mock a response
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(screen.getByRole('button', { name: /loading.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading.../i })).toBeDisabled();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/spotify-link?albumName=${encodeURIComponent(albumName)}&artistName=${encodeURIComponent(artistName)}`
      );
    });
  });

  test('successfully fetches and displays Spotify link', async () => {
    const spotifyUrl = 'https://open.spotify.com/album/testalbum';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spotifyUrl }),
    });
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(await screen.findByRole('link', { name: /open on spotify/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open on spotify/i })).toHaveAttribute('href', spotifyUrl);
    expect(screen.queryByRole('button')).not.toBeInTheDocument(); // Button should be replaced by link
  });

  test('handles "album not found on Spotify" scenario (spotifyUrl is null)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spotifyUrl: null }),
    });
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(await screen.findByText('Album not found on Spotify.')).toBeInTheDocument();
    // Button should still be present to allow retry, or you might decide to hide it
    expect(screen.getByRole('button', { name: /get spotify link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get spotify link/i })).not.toBeDisabled();
  });

  test('handles API error during fetch (response not ok)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' }),
    });
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(await screen.findByText('Internal Server Error')).toBeInTheDocument();
     // Button should still be present
    expect(screen.getByRole('button', { name: /get spotify link/i })).toBeInTheDocument();
  });

  test('handles API error with default message if no message in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}), // Empty error object
    });
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(await screen.findByText('Could not fetch Spotify link. Please try again.')).toBeInTheDocument();
  });


  test('handles network error during fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network connection lost'));
    render(<SpotifyLinkButton albumName={albumName} artistName={artistName} />);

    fireEvent.click(screen.getByRole('button', { name: /get spotify link/i }));

    expect(await screen.findByText('Failed to connect. Please check your network and try again.')).toBeInTheDocument();
     // Button should still be present
    expect(screen.getByRole('button', { name: /get spotify link/i })).toBeInTheDocument();
  });
});
