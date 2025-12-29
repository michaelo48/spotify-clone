import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Create __dirname for ES modules FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file BEFORE importing routes
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// NOW import routes (after env vars are loaded)
import authRouter from './routes/auth.js';
import spotifyRouter from './routes/spotify.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..')));
app.use('/api/auth', authRouter);
app.use('/api/spotify', spotifyRouter);


// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

// SPA catch-all
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 MichaelsMusic server running at http://127.0.0.1:${PORT}`);
});
