import express from 'express';

const router = express.Router();



router.get('/*path', async (req, res) => {
    const accessToken = req.cookies.spotify_access_token;
    
    if (!accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const path = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    
    let spotifyUrl = `https://api.spotify.com/v1/${path}`;
    if (queryString) {
        spotifyUrl += `?${queryString}`;
    }
    
    const response = await fetch(spotifyUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    if (response.status === 401) {
        return res.status(401).json({ error: 'Token expired' });
    }
    
    const data = await response.json();
    res.json(data);
});



export default router;