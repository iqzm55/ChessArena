import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { getOne, run, withTransaction } from '../db/index.js';
import { config } from '../config.js';
import { requireAuth, type AuthRequest, type JwtPayload } from '../middleware/auth.js';
import type { UserRow } from '../db/index.js';

const router = Router();

function userRowToPlayer(row: UserRow): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? row.username,
    avatar: row.avatar_url ?? null,
    walletBalance: row.wallet_balance,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    gamesLost: row.games_lost,
    gamesDraw: row.games_draw,
    totalEarnings: row.total_earnings ?? 0,
    isBanned: !!row.is_banned,
    isFrozen: !!row.is_frozen,
    createdAt: row.created_at,
  };
}

/** POST /api/auth/register */
router.post('/register', async (req, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 2) {
    res.status(400).json({ error: 'Username too short' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = await getOne('SELECT 1 FROM users WHERE username = $1', [trimmed]);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const id = 'player-' + Date.now();
  const password_hash = bcrypt.hashSync(password, 10);
  await run(`
    INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
    VALUES ($1, $2, $3, 'player', NOW(), NOW())
  `, [id, trimmed, password_hash]);

  const row = await getOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  if (!row) {
    res.status(500).json({ error: 'Failed to create user' });
    return;
  }
  const payload: JwtPayload = { userId: row.id, username: row.username, role: row.role as 'admin' | 'player' };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] });

  res.status(201).json({
    user: userRowToPlayer(row),
    token,
    isAdmin: row.role === 'admin',
  });
});

/** POST /api/auth/login */
router.post('/login', async (req, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const row = await getOne<UserRow>('SELECT * FROM users WHERE username = $1', [username.trim().toLowerCase()]);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  if (row.is_banned) {
    res.status(403).json({ error: 'Account banned' });
    return;
  }

  const payload: JwtPayload = { userId: row.id, username: row.username, role: row.role as 'admin' | 'player' };
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] });

  res.json({
    user: userRowToPlayer(row),
    token,
    isAdmin: row.role === 'admin',
  });
});

/** GET /api/auth/me - current user (requires JWT) */
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    user: userRowToPlayer(req.user),
    isAdmin: req.user.role === 'admin',
  });
});

export default router;
