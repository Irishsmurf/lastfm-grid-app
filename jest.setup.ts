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

console.log(
  'Jest setup file executed: Polyfills for WebAPIs and global Spotify mock controls initialized.'
);
