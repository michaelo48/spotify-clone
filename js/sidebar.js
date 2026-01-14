async function getSpotifyPlaylists() {
    try {
        const [playlistsResponse, recentResponse, likedResponse] = await Promise.all([
            fetch(`${API_URL}/api/spotify/me/playlists`, { credentials: 'include' }),
            fetch(`${API_URL}/api/spotify/me/player/recently-played?limit=50`, { credentials: 'include' }),
            fetch(`${API_URL}/api/spotify/me/tracks?limit=1`, { credentials: 'include' }) // Just to get total count
        ]);

        if (playlistsResponse.status === 401) {
            return '<a href="#" id="spotify-login-btn">Login to Spotify</a>';
        }

        if (!playlistsResponse.ok) {
            throw new Error('Failed to fetch playlists');
        }

        const playlistsData = await playlistsResponse.json();

        // Get liked songs count
        let likedSongsCount = 0;
        if (likedResponse.ok) {
            const likedData = await likedResponse.json();
            likedSongsCount = likedData.total || 0;
        }

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

        // Start with Liked Songs as the first item
        let playlistHTML = `
            <div class="playlist-item liked-songs-item">
                <button type="button" onclick="playLikedSongs()">
                    <div class="liked-songs-cover">
                        <span class="material-symbols-outlined">favorite</span>
                    </div>
                </button>
                <div class="playlist-info">
                    <a class="PlaylistName" href="https://open.spotify.com/collection/tracks" target="_blank">Liked Songs</a>
                    <span class="playlist-subtitle">${likedSongsCount.toLocaleString()} songs</span>
                </div>
            </div>`;
        
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

// Play liked songs collection
async function playLikedSongs() {
    const token = await getAccessToken();
    if (!token || !deviceId) {
        console.error('Player not ready');
        return;
    }

    try {
        // Get the user's liked tracks URIs
        const response = await fetch(`${API_URL}/api/spotify/me/tracks?limit=50`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch liked songs');
        
        const data = await response.json();
        const trackUris = data.items.map(item => item.track.uri);
        
        if (trackUris.length === 0) {
            console.log('No liked songs to play');
            return;
        }

        // Play the tracks
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: trackUris })
        });
    } catch (error) {
        console.error('Error playing liked songs:', error);
    }
}

async function sideNav() {
    const playlistsHTML = await getSpotifyPlaylists();
    return `<div class="sidenav">
        <div class="sidebar-header">
            <a href="#">Your Library</a>
            <a href="#">Create Playlist</a>
        </div>
        <div class="sidebar-playlists">
            ${playlistsHTML}
        </div>
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

        // Setup toggle AFTER sidebar is created
        const toggleBtn = document.querySelector('.menu-toggle');
        const sidebar = document.querySelector('.sidenav');
        const mainWrapper = document.querySelector('.main-wrapper');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainWrapper.classList.toggle('expanded');
            });
        }
    }
}

initSidebar();
