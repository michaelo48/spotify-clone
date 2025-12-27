// Spotify API configuration
const CLIENT_ID = 'b7994b73084b47a6a0b168fd02727a7f';
const REDIRECT_URI = 'https://localhost:3010'; // e.g., 'http://localhost:3000/callback'
const SCOPES = 'playlist-read-private playlist-read-collaborative';



// Check if we're returning from Spotify auth
if (window.location.hash.includes('access_token')) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    
    if (token) {
        localStorage.setItem('spotify_access_token', token);
        // Clean up URL by removing the hash
        window.history.replaceState(null, null, window.location.pathname);
    }
}

// Check if user is authenticated
let accessToken = localStorage.getItem('spotify_access_token');

async function getSpotifyPlaylists() {
    if (!accessToken) {
        return '<a href="#" onclick="loginToSpotify()">Login to Spotify</a>';
    }

    try {
        const response = await fetch('https://api.spotify.com/v1/me/playlists', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired
                localStorage.removeItem('spotify_access_token');
                return '<a href="#" onclick="loginToSpotify()">Login to Spotify</a>';
            }
            throw new Error('Failed to fetch playlists');
        }

        const data = await response.json();
        
        // Generate playlist links
        let playlistHTML = '';
        data.items.forEach(playlist => {
            playlistHTML += `<a href="${playlist.external_urls.spotify}" target="_blank">${playlist.name}</a>`;
        });
        
        return playlistHTML || '<a href="#">No playlists found</a>';
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

// Login function
function loginToSpotify() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    window.location.href = authUrl;
}

// Handle OAuth callback (add this to your callback page)
function handleSpotifyCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    
    if (token) {
        localStorage.setItem('spotify_access_token', token);
        window.location.href = '/'; // Redirect back to main page
    }
}

// Initialize sidebar
async function initSidebar() {
    const sideNavElement = document.getElementById('side-nav');
    
    if (sideNavElement) {
        console.log('sidebar loaded');
        sideNavElement.innerHTML = await sideNav();
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