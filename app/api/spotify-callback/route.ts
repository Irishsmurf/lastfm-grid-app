// app/api/spotify-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/spotify'; // Assuming lib is aliased to @/lib

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This 'state' should be the sessionId

  console.log(\`Spotify callback invoked (v2 - using spotify.ts). Code: \${code ? 'received' : 'missing'}, State: \${state}\`);

  if (!state) {
    console.error('State mismatch or missing in Spotify callback.');
    return NextResponse.redirect(new URL('/?error=spotify_auth_failed&reason=state_mismatch', req.nextUrl.origin));
  }

  if (!code) {
    const error = searchParams.get('error');
    console.error(\`Spotify authorization failed or denied by user. Error: \${error}\`);
    return NextResponse.redirect(new URL(\`/?error=spotify_auth_denied&reason=\${error || 'unknown'}\`, req.nextUrl.origin));
  }

  try {
    const success = await exchangeCodeForTokens(code, state); // 'state' is used as sessionId

    if (success) {
      console.log(\`Tokens exchanged and stored successfully for session: \${state}. Redirecting...\`);
      // Redirect user back to the frontend, e.g., to the page that initiated the flow
      // or a page that can now use the stored token.
      return NextResponse.redirect(new URL('/?spotify_auth_success=true', req.nextUrl.origin));
    } else {
      console.error(\`Failed to exchange code for tokens for session: \${state}.\`);
      return NextResponse.redirect(new URL('/?error=spotify_auth_failed&reason=token_exchange_error', req.nextUrl.origin));
    }

  } catch (error: any) { // Should be caught by exchangeCodeForTokens, but as a fallback
    console.error('Critical error during Spotify token exchange process (v2):', error);
    return NextResponse.redirect(new URL(\`/?error=spotify_auth_failed&reason=internal_error\`, req.nextUrl.origin));
  }
}
