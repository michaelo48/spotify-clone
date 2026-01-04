// API Configuration
// Change this to your Render backend URL after deploying
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''  // Empty string for local development (relative URLs)
    : 'https://YOUR-APP-NAME.onrender.com';  // TODO: Replace with your Render URL
