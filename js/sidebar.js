// Spotify API configuration
const CLIENT_ID = 'da6d0a08e3f7425088c56b2f90a9ff00'; // Replace with your new Client ID
const REDIRECT_URI = 'https://michaelo48.netlify.app';
const SCOPES = 'playlist-read-private playlist-read-collaborative user-read-recently-played';


function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}


async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
        const codeVerifier = localStorage.getItem('code_verifier');
        

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.removeItem('code_verifier');
            // Clean up URL
            window.history.replaceState(null, null, window.location.pathname);
            // Reload to show playlists
            location.reload();
        }
    }
}

// Call this on page load
handleCallback();

// Check if user is authenticated
let accessToken = localStorage.getItem('spotify_access_token');

async function getSpotifyPlaylists() {
    if (!accessToken) {
        return '<a href="#" id="spotify-login-btn">Login to Spotify</a>';
    }

    try {
        // Fetch playlists and recently played in parallel
        const [playlistsResponse, recentResponse] = await Promise.all([
            fetch('https://api.spotify.com/v1/me/playlists', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }),
            fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
        ]);

        console.log('Playlists response status:', playlistsResponse.status);
        console.log('Recent played response status:', recentResponse.status);

        if (!playlistsResponse.ok) {
            const errorData = await playlistsResponse.json();
            console.error('Playlists error:', errorData);
            
            if (playlistsResponse.status === 401) {
                localStorage.removeItem('spotify_access_token');
                return '<a href="#" id="spotify-login-btn">Login to Spotify</a>';
            }
            throw new Error('Failed to fetch playlists');
        }

        const playlistsData = await playlistsResponse.json();
        console.log('Playlists data:', playlistsData);

        // Handle recently played separately - don't fail if this errors
        let recentPlaylistUris = [];
        if (recentResponse.ok) {
            const recentData = await recentResponse.json();
            console.log('Recent data:', recentData);
            
            recentData.items.forEach(item => {
                const context = item.context;
                if (context && context.type === 'playlist' && !recentPlaylistUris.includes(context.uri)) {
                    recentPlaylistUris.push(context.uri);
                }
            });
        } else {
            console.warn('Could not fetch recently played:', recentResponse.status);
        }

        // Sort playlists: recently played first, then the rest
        const playlists = playlistsData.items;
        const sortedPlaylists = playlists.sort((a, b) => {
            const aIndex = recentPlaylistUris.indexOf(a.uri);
            const bIndex = recentPlaylistUris.indexOf(b.uri);
            
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return 0;
        });

        // Build HTML - Liked Songs first
        let playlistHTML = `<a href="https://open.spotify.com/collection/tracks" target="_blank">♥ Liked Songs</a>`;
        
        sortedPlaylists.forEach(playlist => {
            playlistHTML += `<a href="${playlist.external_urls.spotify}" target="_blank">${playlist.name}</a>`;
        });

        return playlistHTML;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        return '<a href="#">Error loading playlists</a>';
    }
}

async function sideNav() {
    const playlistsHTML = await getSpotifyPlaylists();
    
    return `<div class="sidenav">
        <a href="#">Open Your Library</a>
        <a href="#">Create Playlist</a>
        ${playlistsHTML}
    </div>`;
}

// Login function with PKCE
async function loginToSpotify() {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);
    
    // Store code verifier for later
    localStorage.setItem('code_verifier', codeVerifier);
    
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', SCOPES);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);
    
    window.location.href = authUrl.toString();
}

// Initialize sidebar
async function initSidebar() {
    const sideNavElement = document.getElementById('side-nav');
    
    if (sideNavElement) {
        console.log('sidebar loaded');
        sideNavElement.innerHTML = await sideNav();
        
        // Add event listener for login button
        const loginBtn = document.getElementById('spotify-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loginToSpotify();
            });
        }
    }
}

// Call init function
initSidebar();

// Your existing toggle code
const toggleBtn = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidenav');
const mainWrapper = document.querySelector('.main-wrapper');
const footer = document.querySelector('footer');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainWrapper.classList.toggle('expanded');
    });
}