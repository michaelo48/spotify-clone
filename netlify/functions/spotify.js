// Netlify Function: Spotify API proxy

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

export async function handler(event) {
    const cookies = parseCookies(event.headers.cookie);
    const accessToken = cookies.spotify_access_token;

    if (!accessToken) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Not authenticated' })
        };
    }

    // Extract the Spotify API path
    // Remove the function prefix to get the actual Spotify endpoint
    let spotifyPath = event.path
        .replace('/.netlify/functions/spotify/', '')
        .replace('/api/spotify/', '');

    // Build the Spotify URL with query parameters
    let spotifyUrl = `https://api.spotify.com/v1/${spotifyPath}`;
    if (event.rawQuery) {
        spotifyUrl += `?${event.rawQuery}`;
    }

    try {
        const response = await fetch(spotifyUrl, {
            method: event.httpMethod,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: event.httpMethod !== 'GET' && event.body ? event.body : undefined
        });

        // Handle 204 No Content
        if (response.status === 204) {
            return {
                statusCode: 204,
                body: ''
            };
        }

        // Handle 401 Unauthorized (token expired)
        if (response.status === 401) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Token expired' })
            };
        }

        const data = await response.json();

        return {
            statusCode: response.status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Spotify API error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to fetch from Spotify' })
        };
    }
}
