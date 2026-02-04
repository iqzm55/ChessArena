import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getDb } from './db/index.js';
import authRoutes from './routes/auth.js';
import publicAuthRoutes from './routes/publicAuth.js';
import walletRoutes from './routes/wallet.js';
import adminRoutes from './routes/admin.js';
import gamesRoutes from './routes/games.js';
import profileRoutes from './routes/profile.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { setupWebSocketServer } from './websocket.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Ensure DB is initialized
getDb();

app.use('/api/auth', authRoutes);
app.use('/', publicAuthRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

setupWebSocketServer(server);
