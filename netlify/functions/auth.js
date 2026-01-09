// Netlify Function: Auth handler for Spotify OAuth

const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-recently-played streaming user-read-playback-state user-modify-playback-state user-read-email user-read-private';

// Parse cookies from header
function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            cookies[name] = value;
        });
    }
    return cookies;
}

// Create cookie string
function createCookie(name, value, maxAge) {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true';
    let cookie = `${name}=${value}; Path=/; HttpOnly; Max-Age=${maxAge}`;
    if (isProduction) {
        cookie += '; Secure; SameSite=None';
    } else {
        cookie += '; SameSite=Lax';
    }
    return cookie;
}

// Clear cookie string
function clearCookie(name) {
    return `${name}=; Path=/; HttpOnly; Max-Age=0`;
}

export async function handler(event) {
    const path = event.path.replace('/.netlify/functions/auth', '').replace('/api/auth', '') || '/';
    const cookies = parseCookies(event.headers.cookie);

    // GET /login - Redirect to Spotify
    if (path === '/login' && event.httpMethod === 'GET') {
        const params = new URLSearchParams({
            client_id: process.env.SPOTIFY_CLIENT_ID,
            response_type: 'code',
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
            scope: SCOPES
        });

        return {
            statusCode: 302,
            headers: {
                Location: `https://accounts.spotify.com/authorize?${params}`
            }
        };
    }

    // GET /callback - Exchange code for tokens
    if (path === '/callback' && event.httpMethod === 'GET') {
        const params = new URLSearchParams(event.rawQuery);
        const code = params.get('code');
        const error = params.get('error');
        const frontendUrl = process.env.FRONTEND_URL || '';

        if (error) {
            return {
                statusCode: 302,
                headers: { Location: `${frontendUrl}/?error=${error}` }
            };
        }

        if (!code) {
            return {
                statusCode: 302,
                headers: { Location: `${frontendUrl}/?error=no_code` }
            };
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
                    ).toString('base64')
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: process.env.SPOTIFY_REDIRECT_URI
                })
            });

            const data = await response.json();

            if (data.error) {
                return {
                    statusCode: 302,
                    headers: { Location: `${frontendUrl}/?error=${data.error}` }
                };
            }

            // Set cookies and redirect
            return {
                statusCode: 302,
                multiValueHeaders: {
                    'Set-Cookie': [
                        createCookie('spotify_access_token', data.access_token, data.expires_in),
                        createCookie('spotify_refresh_token', data.refresh_token, 30 * 24 * 60 * 60)
                    ]
                },
                headers: {
                    Location: `${frontendUrl}/`
                }
            };
        } catch (err) {
            console.error('Token exchange error:', err);
            return {
                statusCode: 302,
                headers: { Location: `${frontendUrl}/?error=token_exchange_failed` }
            };
        }
    }

    // POST /refresh - Refresh access token
    if (path === '/refresh' && event.httpMethod === 'POST') {
        const refreshToken = cookies.spotify_refresh_token;

        if (!refreshToken) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'No refresh token' })
            };
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
                    ).toString('base64')
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            const data = await response.json();

            if (data.error) {
                return {
                    statusCode: 401,
                    multiValueHeaders: {
                        'Set-Cookie': [
                            clearCookie('spotify_access_token'),
                            clearCookie('spotify_refresh_token')
                        ]
                    },
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: data.error })
                };
            }

            const setCookies = [createCookie('spotify_access_token', data.access_token, data.expires_in)];
            if (data.refresh_token) {
                setCookies.push(createCookie('spotify_refresh_token', data.refresh_token, 30 * 24 * 60 * 60));
            }

            return {
                statusCode: 200,
                multiValueHeaders: { 'Set-Cookie': setCookies },
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true })
            };
        } catch (err) {
            console.error('Token refresh error:', err);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Refresh failed' })
            };
        }
    }

    // POST /logout - Clear cookies
    if (path === '/logout' && event.httpMethod === 'POST') {
        return {
            statusCode: 200,
            multiValueHeaders: {
                'Set-Cookie': [
                    clearCookie('spotify_access_token'),
                    clearCookie('spotify_refresh_token')
                ]
            },
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };
    }

    // GET /status - Check login status
    if (path === '/status' && event.httpMethod === 'GET') {
        const hasToken = !!cookies.spotify_access_token;
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedIn: hasToken })
        };
    }

    // GET /token - Return access token for SDK
    if (path === '/token' && event.httpMethod === 'GET') {
        const accessToken = cookies.spotify_access_token;

        if (!accessToken) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Not authenticated' })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken })
        };
    }

    // Not found
    return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not found' })
    };
}
