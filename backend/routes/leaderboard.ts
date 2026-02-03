import { Router, Response } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/', (_req, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, username, display_name, avatar_url, games_won, total_earnings, games_played
    FROM users
    WHERE role = 'player' AND is_banned = 0
    ORDER BY games_won DESC, total_earnings DESC
    LIMIT 100
  `).all() as { id: string; username: string; display_name: string | null; avatar_url: string | null; games_won: number; total_earnings: number; games_played: number }[];

  res.json({
    leaderboard: rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name ?? r.username,
      avatar: r.avatar_url ?? null,
      wins: r.games_won,
      totalEarnings: r.total_earnings ?? 0,
      gamesPlayed: r.games_played,
    })),
  });
});

export default router;
