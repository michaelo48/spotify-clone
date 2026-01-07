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

// Update footer UI with track info
function updateFooterWithTrack(track, isPlaying = false, position = 0) {
    const albumImage = document.querySelector('footer .albumImage');
    if (track.album.images && track.album.images.length > 0) {
        albumImage.src = track.album.images[0].url;
    }

    // Update song title
    const songTitleEl = document.querySelector('footer .songTitle');
    songTitleEl.textContent = track.name;
    songTitleEl.setAttribute('data-text', track.name);
    const songMarquee = songTitleEl.parentElement;
    songMarquee.classList.remove('scrolling');

    // Update artist name(s)
    const artistNames = track.artists.map(artist => artist.name).join(', ');
    const artistNameEl = document.querySelector('footer .artistName');
    artistNameEl.textContent = artistNames;
    artistNameEl.setAttribute('data-text', artistNames);
    const artistMarquee = artistNameEl.parentElement;
    artistMarquee.classList.remove('scrolling');

    // Check for overflow and add scrolling class
    setTimeout(() => {
        if (songTitleEl.offsetWidth > songMarquee.offsetWidth) {
            songMarquee.classList.add('scrolling');
        }
        if (artistNameEl.offsetWidth > artistMarquee.offsetWidth) {
            artistMarquee.classList.add('scrolling');
        }
    }, 50);

    // Update progress bar and time
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.querySelector('.currentTime');
    const totalTimeEl = document.querySelector('.totalTime');

    if (progressBar && track.duration_ms > 0) {
        const percentage = (position / track.duration_ms) * 100;
        progressBar.value = percentage;
    }

    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(position);
    }

    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(track.duration_ms);
    }

    // Update play/pause icon
    const togglePlayIcon = document.getElementById('togglePlay');
    togglePlayIcon.textContent = isPlaying ? 'pause_circle' : 'play_circle';
}

// Fetch currently playing track from Spotify and transfer playback
async function fetchCurrentlyPlaying() {
    try {
        const token = await getAccessToken();
        if (!token) {
            console.log('No token available');
            return;
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 204 || !response.ok) {
            console.log('No track currently playing');
            return;
        }

        const data = await response.json();

        if (data && data.item) {
            updateFooterWithTrack(data.item, data.is_playing, data.progress_ms);

            // Store state for progress updates
            currentState = {
                position: data.progress_ms,
                duration: data.item.duration_ms,
                paused: !data.is_playing,
                timestamp: Date.now()
            };

            if (data.is_playing) {
                clearInterval(progressInterval);
                progressInterval = setInterval(updateProgressBar, 1000);
            }

            // Store the context and position to transfer playback later
            return {
                context_uri: data.context?.uri,
                uris: data.context ? null : [data.item.uri],
                position_ms: data.progress_ms
            };
        }
    } catch (error) {
        console.error('Error fetching currently playing track:', error);
    }
    return null;
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

    // Fetch and display currently playing song
    const playbackInfo = await fetchCurrentlyPlaying();

    player = new Spotify.Player({
        name: 'MichaelsMusic Web Player',
        getOAuthToken: cb => { cb(token); },
        volume: 0.2
    });

    // Ready - device is available
    player.addListener('ready', async ({ device_id }) => {
        console.log('Ready with Device ID:', device_id);
        deviceId = device_id;

        // Transfer playback to this device if there's something playing
        if (playbackInfo) {
            try {
                // First, transfer playback to this device
                await fetch(`https://api.spotify.com/v1/me/player`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        device_ids: [device_id],
                        play: false // Don't auto-play, keep current state
                    })
                });

                // Wait a moment for transfer to complete
                await new Promise(resolve => setTimeout(resolve, 500));

                // Resume playback at the correct position
                const playBody = {
                    position_ms: playbackInfo.position_ms
                };

                if (playbackInfo.context_uri) {
                    playBody.context_uri = playbackInfo.context_uri;
                } else if (playbackInfo.uris) {
                    playBody.uris = playbackInfo.uris;
                }

                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(playBody)
                });

                console.log('Playback transferred to web player');
            } catch (error) {
                console.error('Error transferring playback:', error);
            }
        }
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

        // Update footer with current track info
        updateFooterWithTrack(currentTrack, !state.paused, position);

        // Start/stop progress interval based on playback state
        if (state.paused) {
            clearInterval(progressInterval);
        } else {
            clearInterval(progressInterval);
            progressInterval = setInterval(updateProgressBar, 1000);
        }
    });

    // Errors
    player.addListener('initialization_error', ({ message }) => console.error(message));
    player.addListener('authentication_error', ({ message }) => console.error(message));
    player.addListener('account_error', ({ message }) => console.error('Premium required:', message));
    player.addListener('playback_error', ({ message }) => console.error(message));

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
