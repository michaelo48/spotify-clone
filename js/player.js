let player;
let deviceId = null;





// Spotify SDK calls this when it's ready
window.onSpotifyWebPlaybackSDKReady = async () => {
    await initPlayer();
    document.getElementById('togglePlay').onclick = function() {
        if (player) {
            player.togglePlay();
            console.log('Toggled playback!');
        }
    };
    document.getElementById('nextTrack').onclick = function() {
        if (player) {
            player.nextTrack();
            console.log('Skipped to next track!');
        }
    }
    document.getElementById('prevTrack').onclick = function() {
        if (player) {
            player.previousTrack();
            console.log('Went back to previous track!');
        }
    }

    // TODO: Disable shuffle/repeat when done with selected playlist
    let shuffleEnabled = true;

    document.getElementById('shuffle').onclick = async function() {
        const token = await getAccessToken();
        
        shuffleEnabled = !shuffleEnabled;  // Toggle the state
        
        await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${shuffleEnabled}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Shuffle:', shuffleEnabled ? 'ON' : 'OFF');
    }
    document.getElementById('repeat').onclick = async function() {
        const token = await getAccessToken();
        await fetch('https://api.spotify.com/v1/me/player/repeat?state=context', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        console.log('Repeat enabled!');
    }

    document.getElementById('volume').oninput = function(event) {
        
        const volume = event.target.value
        if (player) {
            player.setVolume(volume / 100);
            console.log('Volume set to', volume);
        }
    console.log('Spotify Web Playback SDK is ready.');
    }


};

async function getAccessToken() {
    // Get token from our backend (stored in cookie, but we need it for the SDK)
    const response = await fetch('/api/auth/token', { credentials: 'include' });
    if (!response.ok) {
        console.log('Failed to get access token');
        return null;
    }
    const data = await response.json();
    return data.access_token;
}

async function initPlayer() {
    const token = await getAccessToken();
    
    if (!token) {
        console.log('No token - user not logged in');
        
        return;
    }

    player = new Spotify.Player({
        name: 'MichaelsMusic Web Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.2
    });

    // Ready - device is available
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID:', device_id);
    });

    // Not Ready - device went offline
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device has gone offline:', device_id);
    });

    // Errors
    player.addListener('initialization_error', ({ message }) => console.error(message));
    player.addListener('authentication_error', ({ message }) => console.error(message));
    player.addListener('account_error', ({ message }) => console.error('Premium required:', message));
    player.addListener('playback_error', ({ message }) => console.error(message));
    player.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID:', device_id);
    deviceId = device_id;  // Store it globally
    });

    // Connect
    player.connect();
}

async function playPlaylist(playlistUri) {
    if (!deviceId) {
        console.error('Player not ready yet');
        return;
    }

    const token = await getAccessToken();
    
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            context_uri: playlistUri  // e.g., "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"
        })
    });
}
