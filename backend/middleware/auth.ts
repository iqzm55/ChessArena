import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import type { UserRow } from '../db/index.js';

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'admin' | 'player';
}

export interface AuthRequest extends Request {
  user?: UserRow;
  jwt?: JwtPayload;
}

function getToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Attach user to request if valid JWT; do not 401. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    if (user && !user.is_banned) {
      req.user = user;
      req.jwt = payload;
    }
  } catch {
    // ignore invalid token
  }
  next();
}

/** Require valid JWT and attach user; 401 if missing/invalid. */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    if (user.is_banned) {
      res.status(403).json({ error: 'Account banned' });
      return;
    }
    req.user = user;
    req.jwt = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require admin role after requireAuth. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
