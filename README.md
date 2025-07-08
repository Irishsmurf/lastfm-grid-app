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
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: Your Google Analytics Measurement ID (e.g., `G-XXXXXXXXXX`). This is used to enable Google Analytics tracking on the site. Set this to your own ID if you want to track user activity.

**Example `.env.local`:**

```env
LASTFM_API_KEY=your_lastfm_api_key_here
LASTFM_BASE_URL=https://ws.audioscrobbler.com/2.0/
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important:** Do not commit your `.env.local` file to version control. It should be listed in your `.gitignore` file (which is standard for Next.js projects).

## Firebase Remote Config for Feature Flags

This project is set up to use Firebase Remote Config to manage feature flags. This allows you to enable or disable features in the application remotely without deploying new code.

### Firebase Setup

1.  **Firebase Project:** Ensure you have a Firebase project set up. The Project ID for this application is `lastfm-grid` (or your specific project ID if you've changed it).
2.  **Environment Variables for Firebase:** In addition to the existing variables, add your Firebase project's configuration to your `.env.local` file:
    ```env
    # ... existing variables
    NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="lastfm-grid" # Or your specific project ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
    NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id" # Optional, if you use Analytics with Remote Config
    ```
    Replace `"your-..."` with your actual Firebase project credentials.
3.  **Firebase Initialization:** The Firebase app and Remote Config are initialized in `lib/firebase.ts`. Default parameters and fetch intervals are also configured here.

### Adding a New Feature Flag

1.  **Define Parameter in Firebase Console:**
    *   Go to your Firebase project console.
    *   Navigate to "Remote Config" (usually under the "Engage" or "Build" section).
    *   Click "Add parameter" or "Create configuration".
    *   **Parameter name (key):** Use a descriptive name (e.g., `my_new_feature_enabled`).
    *   **Data type:** Choose the appropriate type (e.g., Boolean, String, Number, JSON).
    *   **Default value:** Set an initial server-side default value.
    *   Publish the changes in the Firebase console.

2.  **Set In-App Default Value (Recommended):**
    *   Open `lib/firebase.ts`.
    *   Add your new parameter key and its default client-side value to the `remoteConfig.defaultConfig` object. This ensures your app behaves predictably before fetching values from the Firebase backend or if the fetch fails.
      ```typescript
      // In lib/firebase.ts
      remoteConfig.defaultConfig = {
        show_footer_feature_text: false, // Example existing flag
        my_new_feature_enabled: true,    // Your new flag
        // ... other flags
      };
      ```

3.  **Implement in a Client Component:**
    *   Feature flags that affect the UI should typically be implemented in client components (`'use client';`).
    *   Create or modify a component to use the flag. See `components/FooterFeatureText.tsx` for an example implementation. A general structure would be:
      ```tsx
      'use client';

      import { useEffect, useState } from 'react';
      import { remoteConfig } from '@/lib/firebase'; // Adjust path if necessary
      import { fetchAndActivate, getValue } from 'firebase/remote-config';

      const MyFeatureComponent = () => {
        // Use the in-app default as the initial state
        const initialValue = remoteConfig ? getValue(remoteConfig, 'my_new_feature_enabled').asBoolean() : false; // Or appropriate type
        const [isFeatureEnabled, setIsFeatureEnabled] = useState(initialValue);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
          const activateRemoteConfig = async () => {
            setIsLoading(true); // Set loading true at the start of fetch
            try {
              if (remoteConfig) {
                await fetchAndActivate(remoteConfig);
                const flagValue = getValue(remoteConfig, 'my_new_feature_enabled').asBoolean(); // Or .asString(), .asNumber()
                setIsFeatureEnabled(flagValue);
              }
            } catch (error) {
              console.error('Error fetching Remote Config for my_new_feature_enabled:', error);
              // Fallback to the in-app default (already set in useState) or cached value
            } finally {
              setIsLoading(false);
            }
          };
          // Only run activateRemoteConfig if remoteConfig is available.
          // The initial state is already set from defaultConfig.
          if (remoteConfig) {
            activateRemoteConfig();
          } else {
            setIsLoading(false); // Not loading if remoteConfig isn't there
          }
        }, []); // Empty dependency array means this runs once on mount

        if (isLoading && !remoteConfig?.defaultConfig?.['my_new_feature_enabled']) {
          // Optional: show a loader only if not using an instant default
          return <div>Loading feature status...</div>;
        }

        if (isFeatureEnabled) {
          return <div>My New Feature is Here!</div>;
        }

        return <div>My New Feature is OFF.</div>; // Or null if nothing should be shown
      };

      export default MyFeatureComponent;
      ```

4.  **Use the Component:**
    *   Import and use your new component where needed in your application pages or layouts.

### Testing Feature Flags

*   **Unit Tests:** Write Jest tests for your components that consume feature flags. Mock the Firebase SDK (`firebase/remote-config` and your `lib/firebase.ts`) to control the flag values during tests. See `components/FooterFeatureText.test.tsx` for an example.
*   **Manual Testing:**
    *   Run the app locally (`npm run dev`).
    *   Toggle the parameter value in the Firebase Remote Config console and publish changes.
    *   Observe the behavior in your app. Note the `minimumFetchIntervalMillis` setting in `lib/firebase.ts` which controls how often the client fetches updated values (10 seconds for development, 12 hours for production by default). Refreshing the page or waiting for the interval might be necessary.

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
