// app/page.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const LASTFM_API_KEY = process.env.NEXT_PUBLIC_LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

const timeRanges = {
  '7day': "Last Week",
  '1month': 'Last Month',
  '3month': 'Last 3 Months',
  '6month': 'Last 6 Months',
  '12month': 'Last Year',
  'overall': 'Overall'
};

interface Album {
  name: string;
  artist: string;
  image: string;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [timeRange, setTimeRange] = useState('1month');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTopAlbums = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const period = timeRange.replace('month', '');
      const response = await fetch(
        `${LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${LASTFM_API_KEY}&format=json&limit=9`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const data = await response.json();
      const albumData = data.topalbums.album.slice(0, 9).map((album: any) => ({
        name: album.name,
        artist: album.artist.name,
        image: album.image[3]['#text'] // Get largest image
      }));

      setAlbums(albumData);
    } catch (err) {
      setError('Error fetching albums. Please check the username and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                type="text"
                placeholder="LastFM Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1"
              />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeRanges).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={fetchTopAlbums}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Generate Grid'}
              </Button>
            </div>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </CardContent>
        </Card>

        {albums.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {albums.map((album, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="aspect-square relative">
                    <img
                      src={album.image || '/api/placeholder/300/300'}
                      alt={`${album.name} by ${album.artist}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold truncate">{album.name}</p>
                    <p className="text-sm text-gray-600 truncate">{album.artist}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}