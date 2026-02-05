import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { getUserById, getUserByUsername, createUser } from '../models/userModel.js';
import { requireAuth, type AuthRequest, type JwtPayload } from '../middleware/auth.js';
import type { UserRow } from '../db/index.js';

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

function signToken(row: UserRow): string {
  const payload: JwtPayload = {
    userId: row.id,
    username: row.username,
    role: row.role as 'admin' | 'player',
  };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export async function register(req: Request, res: Response): Promise<void> {
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

  const existing = await getUserByUsername(trimmed);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = await createUser({ username: trimmed, passwordHash });
  const row = await getUserById(userId);
  if (!row) {
    res.status(500).json({ error: 'Failed to create user' });
    return;
  }

  const token = signToken(row);
  res.status(201).json({
    user: userRowToPlayer(row),
    token,
    isAdmin: row.role === 'admin',
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const row = await getUserByUsername(username.trim().toLowerCase());
  const invalid =
    !row ||
    !bcrypt.compareSync(password, row.password_hash) ||
    row.is_banned ||
    row.is_frozen;
  if (invalid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = signToken(row);
  res.json({
    user: userRowToPlayer(row),
    token,
    isAdmin: row.role === 'admin',
  });
}

export const me = [
  requireAuth,
  (req: AuthRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
      user: userRowToPlayer(req.user),
      isAdmin: req.user.role === 'admin',
    });
  },
];
