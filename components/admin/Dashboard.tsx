// components/admin/Dashboard.tsx
"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase'; // Adjust path
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface LogEntry {
  id: string;
  username: string;
  albumName: string;
  artistName: string;
  timestamp: any; // Firestore timestamp object
}

interface AggregatedData {
  name: string;
  count: number;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topAlbums, setTopAlbums] = useState<AggregatedData[]>([]);
  const [topArtists, setTopArtists] = useState<AggregatedData[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const logsCollection = collection(db, 'activityLogs');
        // Query last 50 logs, ordered by timestamp descending
        const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(50));
        const logSnapshot = await getDocs(q);
        const logList = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
        setLogs(logList);

        // Aggregate top albums and artists
        const albumCounts: { [key: string]: number } = {};
        const artistCounts: { [key: string]: number } = {};

        logList.forEach(log => {
          albumCounts[log.albumName] = (albumCounts[log.albumName] || 0) + 1;
          artistCounts[log.artistName] = (artistCounts[log.artistName] || 0) + 1;
        });

        const aggregateAndSort = (counts: { [key: string]: number }): AggregatedData[] => {
          return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5
        };

        setTopAlbums(aggregateAndSort(albumCounts));
        setTopArtists(aggregateAndSort(artistCounts));

      } catch (err) {
        console.error("Error fetching logs:", err);
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred while fetching logs.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return <p>Loading dashboard data...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error loading data: {error}</p>;
  }

  return (
    <div>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Top 5 Albums</h2>
        {topAlbums.length > 0 ? (
          <ul className="list-disc pl-5">
            {topAlbums.map(album => (
              <li key={album.name}>{album.name} ({album.count} plays)</li>
            ))}
          </ul>
        ) : (
          <p>No album data yet.</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Top 5 Artists</h2>
        {topArtists.length > 0 ? (
          <ul className="list-disc pl-5">
            {topArtists.map(artist => (
              <li key={artist.name}>{artist.name} ({artist.count} mentions)</li>
            ))}
          </ul>
        ) : (
          <p>No artist data yet.</p>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Recent Activity (Last 50)</h2>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Username</th>
                  <th className="py-2 px-4 border-b">Album</th>
                  <th className="py-2 px-4 border-b">Artist</th>
                  <th className="py-2 px-4 border-b">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="py-2 px-4 border-b">{log.username}</td>
                    <td className="py-2 px-4 border-b">{log.albumName}</td>
                    <td className="py-2 px-4 border-b">{log.artistName}</td>
                    <td className="py-2 px-4 border-b">
                      {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No activity logs found.</p>
        )}
      </section>
    </div>
  );
}
