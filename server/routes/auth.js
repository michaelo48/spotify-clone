import express from 'express';

const router = express.Router();

// ============================================
// CONFIGURATION
// ============================================

// Scopes define what permissions your app is asking for
// - playlist-read-private: Access user's private playlists
// - playlist-read-collaborative: Access collaborative playlists
// - user-read-recently-played: See what they've listened to recently
// You can add more scopes later as you add features (like playback control)
const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-recently-played streaming user-read-playback-state user-modify-playback-state user-read-email user-read-private';
// Frontend URL for redirects after auth
const FRONTEND_URL = process.env.FRONTEND_URL || '';

// Default settings for all cookies we set
// These options make cookies secure and inaccessible to JavaScript
const cookieOptions = {
    httpOnly: true,        // JavaScript cannot read this cookie (protects against XSS attacks)
    secure: process.env.NODE_ENV === 'production',  // Only send over HTTPS in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // 'none' required for cross-origin cookies
    path: '/'              // Cookie is available on all routes
};


// ============================================
// ROUTE: /api/auth/login
// ============================================
// PURPOSE: Start the OAuth flow by redirecting user to Spotify's login page
// 
// HOW IT WORKS:
// 1. User clicks "Login with Spotify" button on your site
// 2. Frontend redirects to /api/auth/login
// 3. This route builds Spotify's authorization URL with your app's info
// 4. User is redirected to Spotify where they log in and approve your app
// 5. Spotify redirects back to your callback URL with an authorization code
//
// NO TOKENS ARE EXCHANGED HERE - this just starts the process
router.get('/login', (req, res) => {
    // Build the query parameters Spotify requires
    const params = new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        scope: SCOPES
    });
    
    // Send the user to Spotify's authorization page
    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});


// ============================================
// ROUTE: /api/auth/callback
// ============================================
// PURPOSE: Handle the redirect from Spotify and exchange the code for tokens
//
// HOW IT WORKS:
// 1. After user approves your app, Spotify redirects here with a "code" in the URL
// 2. We take that code and exchange it for an access_token and refresh_token
// 3. We store both tokens in HTTP-only cookies
// 4. We redirect the user to the home page, now logged in
//
// WHY TWO TOKENS?
// - access_token: Used to make API calls, expires in 1 hour
// - refresh_token: Used to get a new access_token when it expires, lasts much longer
router.get('/callback', async (req, res) => {
    // Spotify sends either a "code" (success) or "error" (user denied or something went wrong)
    const { code, error } = req.query;
    
    // If Spotify sent an error, redirect home with the error message
    if (error) {
        return res.redirect(`${FRONTEND_URL}/?error=${error}`);
    }
    
    // If there's no code, something went wrong
    if (!code) {
        return res.redirect(`${FRONTEND_URL}/?error=no_code`);
    }
    
    try {
        // Exchange the authorization code for tokens
        // This is a server-to-server request (Spotify never sees the user's browser here)
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                // Content type for form data
                'Content-Type': 'application/x-www-form-urlencoded',
                // Basic auth header: base64 encoded "client_id:client_secret"
                // This proves to Spotify that we own this app
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',  // We're exchanging a code for tokens
                code: code,                        // The code Spotify gave us
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI  // Must match exactly what we sent in /login
            })
        });
        
        const data = await response.json();
        
        // If Spotify returned an error, redirect with that error
        if (data.error) {
            return res.redirect(`${FRONTEND_URL}/?error=${data.error}`);
        }
        
        // SUCCESS! We have tokens. Now store them in cookies.
        
        // Store the access token
        // expires_in is in seconds, maxAge needs milliseconds, so multiply by 1000
        res.cookie('spotify_access_token', data.access_token, {
            ...cookieOptions,
            maxAge: data.expires_in * 1000  // Usually 3600 seconds = 1 hour
        });
        
        // Store the refresh token with a longer expiry
        // Refresh tokens don't really expire, but we set 30 days as a reasonable limit
        res.cookie('spotify_refresh_token', data.refresh_token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days in milliseconds
        });
        
        // Redirect to home page - the user is now logged in!
        res.redirect(`${FRONTEND_URL}/`);
        
    } catch (error) {
        console.error('Token exchange error:', error);
        res.redirect(`${FRONTEND_URL}/?error=token_exchange_failed`);
    }
});


// ============================================
// ROUTE: /api/auth/refresh
// ============================================
// PURPOSE: Get a new access token when the current one expires
//
// HOW IT WORKS:
// 1. Frontend makes a request that gets a 401 (unauthorized) error
// 2. Frontend calls this endpoint to refresh the token
// 3. We use the refresh_token cookie to get a new access_token from Spotify
// 4. We update the access_token cookie with the new value
// 5. Frontend retries the original request, which now succeeds
//
// WHY POST?
// This changes state (updates a cookie), so POST is more appropriate than GET
router.post('/refresh', async (req, res) => {
    // Get the refresh token from the cookie
    const refreshToken = req.cookies.spotify_refresh_token;
    
    // If no refresh token exists, user needs to log in again
    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }
    
    try {
        // Ask Spotify for a new access token
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',  // We're refreshing, not doing initial auth
                refresh_token: refreshToken   // The refresh token we stored earlier
            })
        });
        
        const data = await response.json();
        
        // If the refresh token is invalid or expired, clear cookies and require new login
        if (data.error) {
            res.clearCookie('spotify_access_token');
            res.clearCookie('spotify_refresh_token');
            return res.status(401).json({ error: data.error });
        }
        
        // Store the new access token
        res.cookie('spotify_access_token', data.access_token, {
            ...cookieOptions,
            maxAge: data.expires_in * 1000
        });
        
        // Spotify sometimes issues a new refresh token too
        // If it does, we should save it (the old one may stop working)
        if (data.refresh_token) {
            res.cookie('spotify_refresh_token', data.refresh_token, {
                ...cookieOptions,
                maxAge: 30 * 24 * 60 * 60 * 1000
            });
        }
        
        // Tell the frontend the refresh was successful
        res.json({ success: true });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Refresh failed' });
    }
});


// ============================================
// ROUTE: /api/auth/logout
// ============================================
// PURPOSE: Log the user out by clearing their tokens
//
// HOW IT WORKS:
// 1. Delete both cookie tokens from the browser
// 2. User is now logged out - next API call will fail and show login button
//
// NOTE: This doesn't revoke the tokens on Spotify's side
// The tokens technically still work until they expire, but without
// the cookies, the browser can't use them anymore
router.post('/logout', (req, res) => {
    res.clearCookie('spotify_access_token');
    res.clearCookie('spotify_refresh_token');
    res.json({ success: true });
});


// ============================================
// ROUTE: /api/auth/status
// ============================================
// PURPOSE: Let the frontend check if the user is logged in
//
// HOW IT WORKS:
// 1. Check if the access token cookie exists
// 2. Return { loggedIn: true } or { loggedIn: false }
//
// WHY DO WE NEED THIS?
// Since cookies are httpOnly, JavaScript can't read them directly
// So the frontend needs to ask the server "am I logged in?"
router.get('/status', (req, res) => {
    // Check if the access token cookie exists
    // We don't validate the token here - just check existence
    const hasToken = !!req.cookies.spotify_access_token;
    res.json({ loggedIn: hasToken });
});
// ============================================
// ROUTE: /api/auth/token
// ============================================
// PURPOSE: Return the access token for the Web Playback SDK
// The SDK needs the raw token - it can't use cookies
router.get('/token', (req, res) => {
    const accessToken = req.cookies.spotify_access_token;
    
    if (!accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json({ access_token: accessToken });
});

// Export the router so server.js can use it
export default router;
