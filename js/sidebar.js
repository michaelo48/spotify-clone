
async function getSpotifyPlaylists() {

    try {
        const [playlistsResponse, recentResponse] = await Promise.all([
            fetch('/api/spotify/me/playlists', { credentials: 'include' }),
            fetch('/api/spotify/me/player/recently-played?limit=50', { credentials: 'include' })
        ]);

        // If not logged in, show login button
        if (playlistsResponse.status === 401) {
            return '<a href="#" id="spotify-login-btn">Login to Spotify</a>';
        }

        console.log('Playlists response status:', playlistsResponse.status);
        console.log('Recent played response status:', recentResponse.status);

        if (!playlistsResponse.ok) {
            const errorData = await playlistsResponse.json();
            console.error('Playlists error:', errorData);
            
            if (playlistsResponse.status === 401) {
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

function loginToSpotify() {
    window.location.href = '/api/auth/login';
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