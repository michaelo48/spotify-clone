let player;
let deviceId = null;
let progressInterval = null;
let currentState = null;

// Helper function to format milliseconds to mm:ss
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update progress bar UI
function updateProgressBar() {
    if (!currentState || currentState.paused) return;
    
    const position = currentState.position + (Date.now() - currentState.timestamp);
    const duration = currentState.duration;
    
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.querySelector('.currentTime');
    
    if (progressBar && duration > 0) {
        const percentage = (position / duration) * 100;
        progressBar.value = Math.min(percentage, 100);
    }
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(Math.min(position, duration));
    }
}





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

    // Seeking functionality
    document.getElementById('progressBar').oninput = async function(event) {
        if (!currentState) return;
        
        const percentage = event.target.value;
        const seekPosition = Math.floor((percentage / 100) * currentState.duration);
        
        await player.seek(seekPosition);
        console.log('Seeked to', formatTime(seekPosition));
    }


};

async function getAccessToken() {
    // Get token from our backend (stored in cookie, but we need it for the SDK)
    const response = await fetch(`${API_URL}/api/auth/token`, { credentials: 'include' });
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
    player.addListener('player_state_changed', (state) => {
        if (!state) return;  // No state means nothing is playing
        
        const currentTrack = state.track_window.current_track;
        const duration = currentTrack.duration_ms;
        const position = state.position;
        
        currentState = {
            position: position,
            duration: duration,
            paused: state.paused,
            timestamp: Date.now()
        };
        
        const albumImage = document.querySelector('footer .albumImage');
        if (currentTrack.album.images && currentTrack.album.images.length > 0) {
            albumImage.src = currentTrack.album.images[0].url;
        } else {
            console.log('No album images found:', currentTrack.album);
        }
        
        // Update song title
        const songTitleEl = document.querySelector('footer .songTitle');
        songTitleEl.textContent = currentTrack.name;
        const songMarquee = songTitleEl.parentElement;
        songMarquee.classList.remove('scrolling');
        
        // Update artist name(s) - join multiple artists with commas
        const artistNames = currentTrack.artists.map(artist => artist.name).join(', ');
        const artistNameEl = document.querySelector('footer .artistName');
        artistNameEl.textContent = artistNames;
        const artistMarquee = artistNameEl.parentElement;
        artistMarquee.classList.remove('scrolling');
        
        // Check for overflow and add scrolling class to marquee wrapper
        setTimeout(() => {
            if (songTitleEl.offsetWidth > songMarquee.offsetWidth) {
                songMarquee.classList.add('scrolling');
            }
            
            if (artistNameEl.offsetWidth > artistMarquee.offsetWidth) {
                artistMarquee.classList.add('scrolling');
            }
        }, 50);
        
        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        const currentTimeEl = document.querySelector('.currentTime');
        const totalTimeEl = document.querySelector('.totalTime');
        
        if (progressBar && duration > 0) {
            const percentage = (position / duration) * 100;
            progressBar.value = percentage;
        }
        
        if (currentTimeEl) {
            currentTimeEl.textContent = formatTime(position);
        }
        
        if (totalTimeEl) {
            totalTimeEl.textContent = formatTime(duration);
        }
        
        // Start/stop progress interval based on playback state
        if (state.paused) {
            clearInterval(progressInterval);
        } else {
            clearInterval(progressInterval);
            progressInterval = setInterval(updateProgressBar, 1000);
        }
        
        // Update play/pause icon based on paused state
        const togglePlayIcon = document.getElementById('togglePlay');
        togglePlayIcon.textContent = state.paused ? 'play_circle' : 'pause_circle';
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
