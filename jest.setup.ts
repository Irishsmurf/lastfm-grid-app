// jest.setup.ts
import { TextEncoder, TextDecoder } from 'util';

// --- Polyfills must be installed in dependency order before requiring undici ---

// 1. TextEncoder / TextDecoder (undici needs these)
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

// 2. ReadableStream (undici needs this)
if (typeof global.ReadableStream === 'undefined') {
  try {
    const { ReadableStream } = require('stream/web');
    global.ReadableStream = ReadableStream as any;
  } catch (e) {
    console.error('Failed to polyfill ReadableStream:', e);
  }
}

// 3. MessagePort (undici needs this)
if (typeof global.MessagePort === 'undefined') {
  try {
    const { MessagePort } = require('worker_threads');
    global.MessagePort = MessagePort as any;
  } catch (e) {
    console.error('Failed to polyfill MessagePort:', e);
  }
}

// 4. Web Fetch API globals required by next/server (depends on items 1-3 above)
if (typeof global.Request === 'undefined') {
  const { Request, Response, Headers, FormData } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
  global.FormData = FormData;
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
