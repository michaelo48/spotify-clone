async function getSpotifyPlaylists() {
    try {
        const [playlistsResponse, recentResponse] = await Promise.all([
            fetch(`${API_URL}/api/spotify/me/playlists`, { credentials: 'include' }),
            fetch(`${API_URL}/api/spotify/me/player/recently-played?limit=50`, { credentials: 'include' })
        ]);

        if (playlistsResponse.status === 401) {
            return '<a href="#" id="spotify-login-btn">Login to Spotify</a>';
        }

        if (!playlistsResponse.ok) {
            throw new Error('Failed to fetch playlists');
        }

        const playlistsData = await playlistsResponse.json();

        let recentPlaylistUris = [];
        if (recentResponse.ok) {
            const recentData = await recentResponse.json();
            recentData.items?.forEach(item => {
                const context = item.context;
                if (context && context.type === 'playlist' && !recentPlaylistUris.includes(context.uri)) {
                    recentPlaylistUris.push(context.uri);
                }
            });
        }

        const playlists = playlistsData.items || [];
        const sortedPlaylists = playlists.sort((a, b) => {
            const aIndex = recentPlaylistUris.indexOf(a.uri);
            const bIndex = recentPlaylistUris.indexOf(b.uri);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return 0;
        });

        let playlistHTML = `<a href="https://open.spotify.com/collection/tracks" target="_blank">♥ Liked Songs</a>`;
        
        sortedPlaylists.forEach(playlist => {
            let imageUrl = 'placeholder.png';
            if (playlist.images && playlist.images.length > 0) {
                const img60 = playlist.images.find(img => img.height === 60);
                imageUrl = img60 ? img60.url : playlist.images[playlist.images.length - 1].url;
            }
            
            playlistHTML += `
            <div class="playlist-item">
                <button type="button" onclick="playPlaylist('${playlist.uri}')">
                <img class="albumImage" src="${imageUrl}" alt="${playlist.name}">
                </button>
                <a class="PlaylistName" href="${playlist.external_urls.spotify}" target="_blank">${playlist.name}</a>
            </div>`;
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
    window.location.href = `${API_URL}/api/auth/login`;
}

async function initSidebar() {
    const sideNavElement = document.getElementById('side-nav');
    if (sideNavElement) {
        sideNavElement.innerHTML = await sideNav();
        const loginBtn = document.getElementById('spotify-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loginToSpotify();
            });
        }
    }
}

initSidebar();

const toggleBtn = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidenav');
const mainWrapper = document.querySelector('.main-wrapper');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainWrapper.classList.toggle('expanded');
    });
}
