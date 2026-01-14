/* ===========================================
   HOME VIEW
   Renders the home page with personalized content
   =========================================== */

// Get time-based greeting
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

// Fetch data from our backend proxy
async function fetchSpotify(endpoint) {
    const response = await fetch(`${API_URL}/api/spotify/${endpoint}`, {
        credentials: 'include'
    });
    
    if (response.status === 401) {
        return null; // Not logged in
    }
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
    }
    
    return response.json();
}

// Create a card element
function createCard(item, type = 'playlist') {
    const card = document.createElement('div');
    card.className = `card ${type}-card`;
    
    // Get image URL
    let imageUrl = null;
    if (item.images && item.images.length > 0) {
        imageUrl = item.images[0].url;
    } else if (item.album && item.album.images && item.album.images.length > 0) {
        imageUrl = item.album.images[0].url;
    }
    
    // Get subtitle based on type
    let subtitle = '';
    if (type === 'playlist') {
        subtitle = item.description || `By ${item.owner?.display_name || 'Spotify'}`;
    } else if (type === 'album') {
        subtitle = item.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    } else if (type === 'artist') {
        subtitle = 'Artist';
    } else if (type === 'track') {
        subtitle = item.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
    }
    
    // Get URI for playback
    const uri = item.uri || '';
    
    card.innerHTML = `
        <div class="card-image">
            ${imageUrl 
                ? `<img src="${imageUrl}" alt="${item.name}" loading="lazy">` 
                : `<div class="card-image-placeholder"><span class="material-symbols-outlined">music_note</span></div>`
            }
            <button class="card-play-btn" data-uri="${uri}" data-type="${type}">
                <span class="material-symbols-outlined">play_arrow</span>
            </button>
        </div>
        <div class="card-title" title="${item.name}">${item.name}</div>
        <div class="card-subtitle">${subtitle}</div>
    `;
    
    // Add click handler for play button
    const playBtn = card.querySelector('.card-play-btn');
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePlay(uri, type);
    });
    
    // Add click handler for card (navigation - future)
    card.addEventListener('click', () => {
        handleCardClick(item, type);
    });
    
    return card;
}

// Create skeleton loading cards
function createSkeletonCards(count = 6) {
    const container = document.createElement('div');
    container.className = 'card-grid';
    
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'card skeleton';
        skeleton.innerHTML = `
            <div class="card-image skeleton"></div>
            <div class="card-title skeleton"></div>
            <div class="card-subtitle skeleton"></div>
        `;
        container.appendChild(skeleton);
    }
    
    return container;
}

// Handle play button click
async function handlePlay(uri, type) {
    if (!uri) return;
    
    // Use the global playPlaylist function from player.js if available
    if (typeof playPlaylist === 'function' && (type === 'playlist' || type === 'album' || type === 'context')) {
        await playPlaylist(uri);
    } else if (type === 'track') {
        // Play single track
        const token = await getAccessToken();
        if (!token || !deviceId) return;
        
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: [uri] })
        });
    }
}

// Handle card click (for navigation - placeholder for now)
function handleCardClick(item, type) {
    console.log(`Navigate to ${type}:`, item.id, item.name);
    // TODO: Implement routing in Phase 6
}

// Create a section with title and content
function createSection(title, contentElement, seeAllLink = null) {
    const section = document.createElement('section');
    section.className = 'home-section';
    
    section.innerHTML = `
        <div class="section-header">
            <h2 class="section-title">${title}</h2>
            ${seeAllLink ? `<a href="${seeAllLink}" class="section-see-all">See all</a>` : ''}
        </div>
    `;
    
    section.appendChild(contentElement);
    return section;
}

// Extract ID from Spotify URI (spotify:playlist:ID -> ID)
function getIdFromUri(uri) {
    if (!uri) return null;
    const parts = uri.split(':');
    return parts.length === 3 ? parts[2] : null;
}

// Render Recently Played section (playlists & albums)
async function renderRecentlyPlayed() {
    // Fetch more items to get a good variety of unique playlists/albums
    const data = await fetchSpotify('me/player/recently-played?limit=50');
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    // Extract unique playlists and albums from context
    const seen = new Set();
    const uniqueContexts = [];
    
    for (const item of data.items) {
        const context = item.context;
        
        // Only include playlists and albums
        if (!context || (context.type !== 'playlist' && context.type !== 'album')) {
            continue;
        }
        
        // Skip if we've already seen this URI
        if (seen.has(context.uri)) {
            continue;
        }
        
        seen.add(context.uri);
        uniqueContexts.push({
            type: context.type,
            uri: context.uri,
            id: getIdFromUri(context.uri)
        });
        
        // Limit to 6 unique items
        if (uniqueContexts.length >= 6) {
            break;
        }
    }
    
    if (uniqueContexts.length === 0) {
        return null;
    }
    
    // Fetch full details for each playlist/album in parallel
    const detailsPromises = uniqueContexts.map(async (ctx) => {
        try {
            if (ctx.type === 'playlist') {
                return await fetchSpotify(`playlists/${ctx.id}?fields=id,name,uri,images,owner,description`);
            } else if (ctx.type === 'album') {
                return await fetchSpotify(`albums/${ctx.id}`);
            }
        } catch (error) {
            console.error(`Failed to fetch ${ctx.type} ${ctx.id}:`, error);
            return null;
        }
    });
    
    const details = await Promise.all(detailsPromises);
    
    // Filter out any failed fetches
    const validItems = details.filter(item => item !== null);
    
    if (validItems.length === 0) {
        return null;
    }
    
    // Create the grid with compact recent cards
    const grid = document.createElement('div');
    grid.className = 'recent-grid';
    
    validItems.forEach((item, index) => {
        const type = uniqueContexts[index]?.type || 'playlist';
        grid.appendChild(createRecentPlaylistCard(item, type));
    });
    
    return createSection('Recently Played', grid);
}

// Create a compact card for recently played playlists/albums
function createRecentPlaylistCard(item, type = 'playlist') {
    const card = document.createElement('div');
    card.className = 'recent-card';
    
    // Get image URL
    const imageUrl = item.images?.[0]?.url || null;
    const title = item.name;
    const uri = item.uri;
    
    card.innerHTML = `
        <div class="recent-card-image">
            ${imageUrl 
                ? `<img src="${imageUrl}" alt="${title}">` 
                : `<div class="card-image-placeholder"><span class="material-symbols-outlined">${type === 'album' ? 'album' : 'queue_music'}</span></div>`
            }
        </div>
        <span class="recent-card-title" title="${title}">${title}</span>
        <button class="recent-card-play" data-uri="${uri}">
            <span class="material-symbols-outlined">play_arrow</span>
        </button>
    `;
    
    // Add play button handler
    const playBtn = card.querySelector('.recent-card-play');
    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePlay(uri, type);
    });
    
    // Add card click handler (for future navigation)
    card.addEventListener('click', () => {
        handleCardClick(item, type);
    });
    
    return card;
}

// Render Featured Playlists section
async function renderFeaturedPlaylists() {
    const data = await fetchSpotify('browse/featured-playlists?limit=6');
    
    if (!data || !data.playlists || !data.playlists.items) {
        return null;
    }
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    data.playlists.items.forEach(playlist => {
        grid.appendChild(createCard(playlist, 'playlist'));
    });
    
    return createSection(data.message || 'Featured Playlists', grid, '#');
}

// Render New Releases section
async function renderNewReleases() {
    const data = await fetchSpotify('browse/new-releases?limit=6');
    
    if (!data || !data.albums || !data.albums.items) {
        return null;
    }
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    data.albums.items.forEach(album => {
        grid.appendChild(createCard(album, 'album'));
    });
    
    return createSection('New Releases', grid, '#');
}

// Render Browse Categories section
async function renderBrowseCategories() {
    const data = await fetchSpotify('browse/categories?limit=6');
    
    if (!data || !data.categories || !data.categories.items) {
        return null;
    }
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    data.categories.items.forEach(category => {
        grid.appendChild(createCategoryCard(category));
    });
    
    return createSection('Browse Categories', grid, '#');
}

// Create a category card
function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'card category-card';
    
    // Get image URL (categories use 'icons' instead of 'images')
    const imageUrl = category.icons?.[0]?.url || null;
    
    card.innerHTML = `
        <div class="card-image">
            ${imageUrl 
                ? `<img src="${imageUrl}" alt="${category.name}" loading="lazy">` 
                : `<div class="card-image-placeholder"><span class="material-symbols-outlined">category</span></div>`
            }
        </div>
        <div class="card-title" title="${category.name}">${category.name}</div>
    `;
    
    // Add click handler for card (navigate to category - future)
    card.addEventListener('click', () => {
        handleCardClick(category, 'category');
    });
    
    return card;
}

// Render User's Top Artists section
async function renderTopArtists() {
    const data = await fetchSpotify('me/top/artists?limit=6&time_range=short_term');
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    data.items.forEach(artist => {
        grid.appendChild(createCard(artist, 'artist'));
    });
    
    return createSection('Your Top Artists', grid, '#');
}

// Render User's Top Tracks as "Made For You" mix
async function renderTopMixes() {
    const data = await fetchSpotify('me/top/tracks?limit=6&time_range=short_term');
    
    if (!data || !data.items || data.items.length === 0) {
        return null;
    }
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    data.items.forEach(track => {
        grid.appendChild(createCard(track, 'track'));
    });
    
    return createSection('Your Top Tracks', grid, '#');
}

// Main render function
async function renderHomePage() {
    const main = document.querySelector('main .main');
    
    if (!main) {
        console.error('Main container not found');
        return;
    }
    
    // Check if logged in first
    const statusResponse = await fetch(`${API_URL}/api/auth/status`, { credentials: 'include' });
    const status = await statusResponse.json();
    
    if (!status.loggedIn) {
        main.innerHTML = `
            <div class="home-container">
                <h1 class="home-greeting">${getGreeting()}</h1>
                <div class="empty-state">
                    <span class="material-symbols-outlined">login</span>
                    <h3>Login to see your music</h3>
                    <p>Connect with Spotify to see your playlists, recently played, and more.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Show loading state
    main.innerHTML = `
        <div class="home-container">
            <h1 class="home-greeting">${getGreeting()}</h1>
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <span>Loading your music...</span>
            </div>
        </div>
    `;
    
    try {
        // Fetch all sections in parallel
        const [recentSection, featuredSection, newReleasesSection, categoriesSection, topArtistsSection, topTracksSection] = 
            await Promise.all([
                renderRecentlyPlayed(),
                renderFeaturedPlaylists(),
                renderNewReleases(),
                renderBrowseCategories(),
                renderTopArtists(),
                renderTopMixes()
            ]);
        
        // Build the home page
        const container = document.createElement('div');
        container.className = 'home-container';
        
        // Add greeting
        const greeting = document.createElement('h1');
        greeting.className = 'home-greeting';
        greeting.textContent = getGreeting();
        container.appendChild(greeting);
        
        // Add sections (only if they have content)
        if (recentSection) container.appendChild(recentSection);
        if (topTracksSection) container.appendChild(topTracksSection);
        if (topArtistsSection) container.appendChild(topArtistsSection);
        if (featuredSection) container.appendChild(featuredSection);
        if (newReleasesSection) container.appendChild(newReleasesSection);
        if (categoriesSection) container.appendChild(categoriesSection);
        
        // Replace loading with content
        main.innerHTML = '';
        main.appendChild(container);
        
    } catch (error) {
        console.error('Error rendering home page:', error);
        main.innerHTML = `
            <div class="home-container">
                <h1 class="home-greeting">${getGreeting()}</h1>
                <div class="error-message">
                    <h3>Something went wrong</h3>
                    <p>We couldn't load your music. Please try again.</p>
                    <button onclick="renderHomePage()">Retry</button>
                </div>
            </div>
        `;
    }
}

// Initialize home page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other scripts (player, sidebar) initialize first
    setTimeout(renderHomePage, 100);
});
