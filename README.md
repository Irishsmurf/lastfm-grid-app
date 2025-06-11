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


## Features

### Shared Collections

This application allows users to create and share a snapshot of their favorite albums from Last.fm.

-   **Create a Shared Collection**:
    -   On the homepage, you'll find a form titled "Share Your Music Taste."
    -   Enter your Last.fm username.
    -   Select a time period (e.g., last 7 days, last month, overall).
    -   Provide a title and an optional description for your collection.
    -   Upon submission, a unique shareable link will be generated for your collection.
-   **View a Shared Collection**:
    -   Shared collections can be viewed by anyone with the link (e.g., `yourdomain.com/share/<collectionId>`). The actual base URL will depend on your deployment.
    -   The page displays the collection's title, description, the user who created it, the time period, and the grid of albums.
    -   Each album includes album art and a button to fetch a link to listen on Spotify.

### API Endpoints

The Shared Collections feature utilizes the following API endpoints:

-   `POST /api/share`
    -   Creates a new shared collection.
    -   **Request Body**:
        ```json
        {
          "username": "string",
          "period": "string (e.g., 7day, 1month, overall)",
          "title": "string",
          "description": "string (optional)"
        }
        ```
    -   **Success Response (201 Created)**:
        ```json
        {
          "message": "Collection created successfully",
          "collectionId": "string (UUID)"
        }
        ```
-   `GET /api/share/[collectionId]`
    -   Retrieves an existing shared collection by its ID.
    -   **Success Response (200 OK)**: The shared collection object, including `id`, `username`, `period`, `title`, `description`, `albumsData` (from Last.fm), and `createdAt`.