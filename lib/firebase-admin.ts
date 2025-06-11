// lib/firebase-admin.ts
import * as admin from 'firebase-admin';

// IMPORTANT: Replace with your actual Firebase service account details
// It's STRONGLY recommended to use environment variables for these
// and ensure the service account JSON file is NOT committed to your repository.
const serviceAccount = {
  type: process.env.FIREBASE_ADMIN_TYPE,
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'), // Handle escaped newlines
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN || "googleapis.com",
} as admin.ServiceAccount; // Type assertion

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` // Optional: if using Realtime Database
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      // Prevent app from starting if Firebase Admin fails to initialize,
      // or handle gracefully depending on application requirements.
      // For this API route, it's critical, so we might let it fail.
      throw error;
    }
  }
  return admin;
}

// Export a pre-initialized admin instance or the initializer
// Exporting the initializer is often safer to ensure it's called at the right time.
// For API routes, initializing once per route invocation (or checking if initialized) is common.
// const firebaseAdmin = initializeFirebaseAdmin();
// export { firebaseAdmin };

// Let's export the initializer and a getter for db for cleaner use in API routes
export { initializeFirebaseAdmin };
export const getFirebaseAdminDb = () => {
  initializeFirebaseAdmin(); // Ensures it's initialized
  return admin.firestore();
};
