# LastFM Grid

## LastFM Album Generator.

Creates a 3x3 grid from [Last.fm](https://ww.last.fm/).

## Environment Variables

To run this project, you will need to create a `.env.local` file in the root directory and add the following environment variables:

```
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_BASE_URL=https://ws.audioscrobbler.com/2.0/
REDIS_URL=your_redis_url
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

- `LASTFM_API_KEY`: Your API key from Last.fm.
- `LASTFM_BASE_URL`: The base URL for the Last.fm API.
- `REDIS_URL`: The URL for your Redis instance (e.g., `redis://localhost:6379`).
- `SPOTIFY_CLIENT_ID`: Your Spotify application client ID.
- `SPOTIFY_CLIENT_SECRET`: Your Spotify application client secret.