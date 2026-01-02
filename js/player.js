let player;

// Spotify SDK calls this when it's ready
window.onSpotifyWebPlaybackSDKReady = async () => {
    await initPlayer();
    document.getElementById('togglePlay').onclick = function() {
        if (player) {
            player.togglePlay();
            console.log('Toggled playback!');
        }
    };
    console.log('Spotify Web Playback SDK is ready.');

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
        volume: 0.1
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

    // Connect
    player.connect();
}
