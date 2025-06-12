# LastFM Grid Album Art Generator

Creates a 3x3 grid of album art based on your Last.fm listening history for a selected period. It also attempts to find a Spotify link for each album.

## Features

- Fetches your top albums from Last.fm for a given period (7-day, 1-month, 3-month, 6-month, 12-month, overall).
- Displays album art in a 3x3 grid.
- Searches for corresponding Spotify links for each album.
- Caches API responses (Last.fm and Spotify) in Redis to improve performance and reduce API rate limit issues.
- Responsive design.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18.x or later recommended)
- npm (v9.x or later recommended) or yarn
- Access to a Redis instance

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/lastfm-grid-app.git # Replace with actual repo URL if known
    cd lastfm-grid-app
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of your project by copying the example:

    ```bash
    cp .env.example .env.local
    ```

    (Note: An `.env.example` file should ideally be created in the repo. Assuming one would exist for this instruction).

    Then, fill in your credentials in `.env.local`. See the "Environment Variables" section below for details on each variable.

### Running the Development Server

Once the installation is complete and environment variables are set up:

```bash
npm run dev
# or
# yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Environment Variables

To run this project, you will need to create a `.env.local` file in the root directory and add the following environment variables:

- `LASTFM_API_KEY`: Your API key from [Last.fm](https://www.last.fm/api/account/create). Required for fetching album data.
- `LASTFM_BASE_URL`: The base URL for the Last.fm API. Defaults to `https://ws.audioscrobbler.com/2.0/` if not set, but can be overridden.
- `SPOTIFY_CLIENT_ID`: Your Spotify application client ID from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/). Required for fetching Spotify album links.
- `SPOTIFY_CLIENT_SECRET`: Your Spotify application client secret. Required for fetching Spotify album links.
- `REDIS_URL`: The connection URL for your Redis instance (e.g., `redis://localhost:6379` or `redis://:yourpassword@yourhost:yourport`). Required for caching API responses.

**Example `.env.local`:**

```env
LASTFM_API_KEY=your_lastfm_api_key_here
LASTFM_BASE_URL=https://ws.audioscrobbler.com/2.0/
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
REDIS_URL=redis://localhost:6379
```

**Important:** Do not commit your `.env.local` file to version control. It should be listed in your `.gitignore` file (which is standard for Next.js projects).

## Code Overview & Architecture

The backend logic for this application has been structured into a service-oriented architecture, primarily residing in the `lib/` directory. This approach promotes separation of concerns and makes the code more modular and testable.

- **`lib/lastfmService.ts`**: Handles all interactions with the Last.fm API, including fetching top albums.
- **`lib/spotifyService.ts`**: Manages communication with the Spotify API. This includes obtaining an access token using client credentials and searching for albums.
- **`lib/redis.ts`**: Configures and exports the Redis client instance used for caching.
- **`lib/cache.ts`**: Provides a generic caching utility (`handleCaching` function) that wraps around Redis operations. This function is used by API routes to cache data fetched from external services like Last.fm and Spotify, including specific handling for "not found" responses.
- **`lib/utils.ts`**: Contains utility functions, such as `cn` for conditionally joining CSS class names with Tailwind CSS conflict resolution.

**API Routes (`app/api/`)**

The API routes within the `app/api/` directory (e.g., `app/api/albums/route.ts`, `app/api/spotify-link/route.ts`) now primarily serve as request handlers. They are responsible for:

1.  Validating incoming request parameters.
2.  Calling the appropriate service functions from the `lib/` directory to fetch data or perform actions. These calls are usually wrapped with the `handleCaching` utility to leverage Redis caching.
3.  Formatting the response and sending it back to the client.

This architecture keeps the API route handlers lean and delegates the core business logic and external API interactions to the dedicated service modules.

## Available Scripts

In the `package.json`, the following scripts are available:

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the app for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Lints the codebase using Next.js's ESLint configuration.
- `npm run lint:fix`: Lints the codebase and attempts to automatically fix issues.
- `npm run format`: Formats the codebase using Prettier.
- `npm run test`: Runs tests using Jest.

## Contributing

Contributions are welcome! If you have suggestions for improvements or find a bug, please open an issue or submit a pull request.

(Further sections like "Deployment", "Built With", etc., could be added as the project evolves.)
