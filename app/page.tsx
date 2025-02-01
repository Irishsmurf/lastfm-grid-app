// app/page.tsx
'use client';

import { useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download } from 'lucide-react';

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

interface AlbumImage {
  'size': string;
  '#text': string;
}

interface Album {
  name: string;
  artist: Artist;
  image: Array<AlbumImage>;
  mbid: string;
  playcount: number;
}

interface Artist {
  name: string;
  url: string;
  mbid: string;
}

export default function Home() {
  const [username, setUsername] = useState('');
  const [timeRange, setTimeRange] = useState('1month');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchTopAlbums = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const period = timeRange;
      const response = await fetch(
        `${LASTFM_BASE_URL}?method=user.gettopalbums&user=${username}&period=${period}&api_key=${LASTFM_API_KEY}&format=json&limit=9`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const data = await response.json();
      const albumData = data.topalbums.album.slice(0, 9).map((album: Album) => ({
        name: album.name,
        artist: album.artist,
        image: album.image, // Get largest image
        mbid: album.mbid,
        playcount: album.playcount
      }));

      setAlbums(albumData);
    } catch (err) {
      console.error('An error occurred: ', err);
      setError('Error fetching albums. Please check the username and try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!canvasRef.current || albums.length !== 9) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 900;
    canvas.height = 900;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load all images first
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Enable CORS
        img.onload = () => resolve(img);
        img.onerror = () => {
          // Create a placeholder for failed images
          const placeholder = new Image();
          placeholder.src = '/api/placeholder/300/300';
          resolve(placeholder);
        };
        img.src = url;
      });
    };

    try {
      // Create 3x3 grid
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * 300;
        const y = Math.floor(i / 3) * 300;
        
        const img = await loadImage(albums[i].image[3]['#text']);
        ctx.drawImage(img, x, y, 300, 300);
      }

      // Add watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
      ctx.fillStyle = '#000000';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${username}'s Top Albums - ${timeRanges[timeRange as keyof typeof timeRanges]}`, canvas.width / 2, canvas.height - 10);

      // Trigger download
      const link = document.createElement('a');
      link.download = `${username}-${timeRange}-albums.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.8);
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image. Please try again.');
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
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={generateImage} className="gap-2">
                <Download size={16} />
                Download Grid
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {albums.map((album, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="aspect-square relative">
                      <img
                        src={album.image[3]?.['#text'] || '/api/placeholder/300/300'}
                        alt={`${album.name} by ${album.artist}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2">
                      <p className="font-semibold truncate">{album.name}</p>
                      <p className="text-sm text-gray-600 truncate">{album.artist.name}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}