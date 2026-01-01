import { fileURLToPath } from 'url';

// --- BUILD PROTECTION (Absolute Top) ---
// If this script is imported during a build process, exit immediately with Success (0).
// This ensures the build pipeline doesn't hang or crash due to backend logic.
if (process.env.npm_lifecycle_event === 'build') {
    process.exit(0);
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { initDB } from './config/db.js';
import apiRoutes from './routes/api.js';
import { setupLiveServer } from './services/liveService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    if (!req.url.startsWith('/static') && !req.url.includes('.')) {
        console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
});

// --- ROUTES ---
app.use('/api', apiRoutes);

// --- STATIC SERVING ---
const buildPath = path.join(__dirname, '..', 'build');
if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        if (req.url.startsWith('/api')) return res.status(404).json({ error: "API route not found" });
        res.sendFile(path.join(buildPath, 'index.html'));
    });
}

// --- STARTUP SEQUENCE ---
const startServer = async () => {
    // Double check guard
    if (process.env.npm_lifecycle_event === 'build') return;

    try {
        console.log("🚀 Starting Server Initialization...");
        
        // Initialize DB first
        await initDB();

        // Start Server only if DB is ok
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n✅ Server successfully running on http://0.0.0.0:${PORT}`);
        });

        // Setup WebSocket
        const wss = new WebSocketServer({ server });
        setupLiveServer(wss);

    } catch (err) {
        console.error("\n❌ SERVER STARTUP FAILED:");
        console.error(err.message);
        process.exit(1);
    }
};

// Strict check: Only run if this file is the main module being executed.
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    startServer();
}