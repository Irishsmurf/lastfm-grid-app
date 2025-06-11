// app/api/spotify-callback/route.test.ts
import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/spotify'; // Import the mocked function

// Mock the lib/spotify module (if not already globally mocked or if more specific control is needed here)
jest.mock('@/lib/spotify');

// Helper to create a mock NextRequest for a GET request with query parameters
function createMockNextRequest(queryParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/spotify-callback');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return new NextRequest(url.toString());
}

describe('GET /api/spotify-callback', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear all mock calls and implementations

    // Set a default implementation for exchangeCodeForTokens for most tests
    (exchangeCodeForTokens as jest.Mock).mockResolvedValue(true);
  });

  it('should redirect to an error page if state is missing', async () => {
    // No 'state' in queryParams
    const req = createMockNextRequest({ code: 'test-code' });
    const response = await GET(req);

    expect(response.status).toBe(307); // Or 302, depending on Next.js version/config for NextResponse.redirect
    expect(response.headers.get('Location')).toContain('/?error=spotify_auth_failed&reason=state_mismatch');
  });

  it('should redirect to an error page if code is missing and no error param from Spotify', async () => {
    const req = createMockNextRequest({ state: 'test-state' }); // No 'code'
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/?error=spotify_auth_denied&reason=unknown');
  });

  it('should redirect to an error page if code is missing and Spotify provided an error param', async () => {
    const req = createMockNextRequest({ state: 'test-state', error: 'access_denied' });
    const response = await GET(req);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/?error=spotify_auth_denied&reason=access_denied');
  });


  it('should call exchangeCodeForTokens with code and state, and redirect on success', async () => {
    const req = createMockNextRequest({ code: 'test-code', state: 'test-state-session' });
    const response = await GET(req);

    expect(exchangeCodeForTokens).toHaveBeenCalledWith('test-code', 'test-state-session');
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('/?spotify_auth_success=true');
  });

  it('should redirect to an error page if exchangeCodeForTokens returns false', async () => {
    (exchangeCodeForTokens as jest.Mock).mockResolvedValue(false); // Simulate failure
    const req = createMockNextRequest({ code: 'test-code', state: 'test-state-session' });
    const response = await GET(req);

    expect(exchangeCodeForTokens).toHaveBeenCalledWith('test-code', 'test-state-session');
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/?error=spotify_auth_failed&reason=token_exchange_error');
  });

  it('should handle critical errors during exchange and redirect to an error page', async () => {
    (exchangeCodeForTokens as jest.Mock).mockRejectedValue(new Error("Critical failure")); // Simulate unexpected throw
    const req = createMockNextRequest({ code: 'test-code', state: 'test-state-session' });
    const response = await GET(req);

    expect(exchangeCodeForTokens).toHaveBeenCalledWith('test-code', 'test-state-session');
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/?error=spotify_auth_failed&reason=internal_error');
  });
});
