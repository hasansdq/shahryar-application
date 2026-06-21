import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from 'ws';
import { setupLiveServer } from './server/services/liveService.js';
import apiRoutes from './server/routes/api.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // AI routes
  app.use('/api', apiRoutes);

  // We can leave API routes out or add health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist'); // using dist
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Setup WebSocket for Gemini Live
  const wss = new WebSocketServer({ server, path: '/live' });
  setupLiveServer(wss);
}

startServer();
