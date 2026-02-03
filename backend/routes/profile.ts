import { Router, Response } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import type { GameRow } from '../db/index.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const u = req.user;
  res.json({
    profile: {
      id: u.id,
      username: u.username,
      displayName: u.display_name ?? u.username,
      avatar: u.avatar_url ?? null,
      walletBalance: u.wallet_balance,
      gamesPlayed: u.games_played,
      gamesWon: u.games_won,
      gamesLost: u.games_lost,
      gamesDraw: u.games_draw,
      totalEarnings: u.total_earnings ?? 0,
      createdAt: u.created_at,
    },
  });
});

router.put('/', (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { displayName, avatarDataUrl } = req.body as { displayName?: string; avatarDataUrl?: string | null };
  const name = typeof displayName === 'string' ? displayName.trim() : null;
  if (name && (name.length < 2 || name.length > 24)) {
    return res.status(400).json({ error: 'Display name must be 2-24 characters' });
  }
  let avatar: string | null = null;
  if (typeof avatarDataUrl === 'string' && avatarDataUrl.length > 0) {
    if (!avatarDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Avatar must be an image data URL' });
    }
    if (avatarDataUrl.length > 250000) {
      return res.status(400).json({ error: 'Avatar image is too large' });
    }
    avatar = avatarDataUrl;
  }
  const db = getDb();
  db.prepare(
    "UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE id = ?"
  ).run(name, avatar, req.user.id);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as typeof req.user;
  res.json({
    profile: {
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
      createdAt: row.created_at,
    },
  });
});

router.get('/history', (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const rows = db.prepare(`
    SELECT g.*, w.username as white_username, w.display_name as white_display, w.avatar_url as white_avatar,
           b.username as black_username, b.display_name as black_display, b.avatar_url as black_avatar
    FROM games g
    LEFT JOIN users w ON w.id = g.white_user_id
    LEFT JOIN users b ON b.id = g.black_user_id
    WHERE g.white_user_id = ? OR g.black_user_id = ?
    ORDER BY g.ended_at DESC, g.created_at DESC
    LIMIT 50
  `).all(req.user.id, req.user.id) as (GameRow & {
    white_username: string | null;
    white_display: string | null;
    white_avatar: string | null;
    black_username: string | null;
    black_display: string | null;
    black_avatar: string | null;
  })[];

  const history = rows.map((g) => {
    const isWhite = g.white_user_id === req.user!.id;
    const opponent = isWhite
      ? { id: g.black_user_id, username: g.black_username, displayName: g.black_display, avatar: g.black_avatar }
      : { id: g.white_user_id, username: g.white_username, displayName: g.white_display, avatar: g.white_avatar };
    const outcome = g.result
      ? g.result === 'draw'
        ? 'draw'
        : (g.result === (isWhite ? 'white' : 'black') ? 'win' : 'loss')
      : 'unknown';
    const payout = isWhite ? (g.white_payout ?? 0) : (g.black_payout ?? 0);
    const moneyChange = Math.round((payout - g.entry_fee) * 100) / 100;

    return {
      gameId: g.id,
      mode: g.mode,
      outcome,
      opponent,
      entryFee: g.entry_fee,
      payout,
      moneyChange,
      endedAt: g.ended_at,
      startedAt: g.started_at,
    };
  });

  res.json({ history });
});

export default router;
