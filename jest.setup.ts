// jest.setup.ts
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder and TextDecoder if they are not available globally
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any; // Cast to any to bypass type mismatch
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any; // Cast to any to bypass type mismatch
}

// Polyfill ReadableStream if not available
if (typeof global.ReadableStream === 'undefined') {
  try {
    const { ReadableStream } = require('stream/web');
    global.ReadableStream = ReadableStream as any;
  } catch (e) {
    console.error('Failed to polyfill ReadableStream from stream/web:', e);
    // Fallback or further error handling if needed
  }
}

// Polyfill MessagePort if not available
if (typeof global.MessagePort === 'undefined') {
  try {
    const { MessagePort } = require('worker_threads');
    global.MessagePort = MessagePort as any;
  } catch (e) {
    console.error('Failed to polyfill MessagePort from worker_threads:', e);
  }
}

// Polyfill Request, Response, Headers, fetch if not available or to ensure consistency
// Using undici components for Node.js environment compatibility with Web APIs
// This is often needed for testing Next.js API routes or server components in Jest

// Initialize global controls for Spotify mocks
// This ensures it's available before any jest.mock factory functions in test files are executed.
declare global {
  var __spotifyMockControls: {
    searchAlbumsResult: any;
    clientCredentialsGrantResult: any;
    getAccessTokenValue: string | null;
  };
}

global.__spotifyMockControls = {
  searchAlbumsResult: { body: { albums: { items: [] } } },
  clientCredentialsGrantResult: {
    body: { access_token: 'initial-mock-access-token' },
  },
  getAccessTokenValue: 'initial-mock-access-token',
};

if (typeof global.Request === 'undefined') {
  try {
    const undici = require('undici'); // require after TextEncoder/Decoder, ReadableStream, MessagePort are polyfilled
    global.Request = undici.Request;
    global.Response = undici.Response;
  } catch (e) {
    console.error(
      'Failed to initialize undici for Request/Response polyfills:',
      e
    );
    // Fallback or define basic mocks if undici fails (e.g. due to Node version)
    if (typeof global.Request === 'undefined') {
      global.Request = class MockRequest {} as any; // Basic mock
    }
    if (typeof global.Response === 'undefined') {
      global.Response = class MockResponse {} as any; // Basic mock
    }
  }
  // global.Headers, global.fetch etc. would also come from undici if Request/Response are successfully polyfilled
  // For now, the primary concern for API tests was Request/Response for NextRequest/NextResponse
}

// You can also add other global setup here, e.g., for @testing-library/jest-dom
// import '@testing-library/jest-dom'; // This is often in page.test.tsx but can be global
// However, it's usually fine where it is, as long as it's imported before tests that need it.

console.log(
  'Jest setup file executed: Polyfills for WebAPIs and global Spotify mock controls initialized.'
);
