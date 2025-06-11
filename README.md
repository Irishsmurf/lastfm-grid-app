# Last.fm Album Art Grid & User Trends Analyzer

This web application allows users to generate a 3x3 grid of their top Last.fm album art and provides an administrative interface for analyzing user activity trends.

## Features

*   **Last.fm Top Album Grid:**
    *   Fetches a user's top albums from Last.fm for a selected period.
    *   Displays album art in a 3x3 grid.
*   **Admin Dashboard (Firebase Powered):**
    *   Secure login for administrators.
    *   Tracks and logs user searches (username, album, artist) to Firestore.
    *   Displays metrics such as:
        *   Top 5 most searched albums.
        *   Top 5 most mentioned artists.
        *   Recent search activity.

## Tech Stack

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS
*   **Backend:** Next.js API Routes
*   **Database:** Firestore (for activity logging and admin users)
*   **Authentication:** Firebase Authentication
*   **Caching:** Redis (for Last.fm API responses)
*   **API:** Last.fm API

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   Node.js (v18.x or later recommended)
*   npm or yarn
*   Access to a Redis instance
*   A Firebase project

### Environment Variables

Create a `.env.local` file in the root of the project and add the following environment variables. Replace the placeholder values with your actual credentials and configuration.

```
# Last.fm API Configuration
LASTFM_BASE_URL=https://ws.audioscrobbler.com/2.0/
LASTFM_API_KEY=YOUR_LASTFM_API_KEY

# Redis Configuration
REDIS_URL=your_redis_connection_string # Used by lib/redis.ts

# Firebase Project Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
# NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_FIREBASE_MEASUREMENT_ID" # Optional
```

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```
2.  Install NPM packages:
    ```bash
    npm install
    # or
    # yarn install
    ```

### Running the Development Server

```bash
npm run dev
# or
# yarn dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Admin Section Setup

To access the admin dashboard (`/admin`), you need to designate users as administrators:

1.  **Create a User Account:** Ensure the user you want to make an admin has an account in Firebase Authentication (e.g., by signing them up through a test interface or manually adding them in the Firebase console).
2.  **Add User UID to Admins Collection:**
    *   In your Firestore database, create a collection named `admins`.
    *   For each user you want to grant admin privileges, add a new document to this `admins` collection.
    *   The **Document ID** for this new document *must be* the Firebase UID of the user.
    *   The fields within the document can be left empty; its existence is what grants admin rights.
3.  Log in via `/admin/login` with the designated admin user's credentials.

## API Endpoints

*   `GET /api/albums`: Fetches top albums for a Last.fm user.
    *   Query Parameters:
        *   `username`: The Last.fm username.
        *   `period`: The time period (e.g., `7day`, `1month`, `overall`).

## Deployment

This application is built with Next.js and can be deployed to any platform that supports Next.js applications, such as Vercel or Netlify. Ensure all necessary environment variables are configured on your deployment platform.
