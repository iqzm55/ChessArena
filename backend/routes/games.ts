import { Router, Response } from 'express';
import { GAME_MODES } from '../config.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

/** GET /api/games/modes - public game mode config (entry fee, time) */
router.get('/modes', (_req, res: Response) => {
  const modes: Record<string, { mode: string; timeControl: number; entryFee: number }> = {};
  for (const [k, v] of Object.entries(GAME_MODES)) {
    modes[k] = { mode: k, timeControl: v.timeControl, entryFee: v.entryFee };
  }
  res.json({ modes });
});

/** GET /api/games/entry-fee/:mode */
router.get('/entry-fee/:mode', (req, res: Response) => {
  const mode = req.params.mode as keyof typeof GAME_MODES;
  if (!GAME_MODES[mode]) {
    return res.status(400).json({ error: 'Invalid game mode' });
  }
  res.json({ mode, entryFee: GAME_MODES[mode].entryFee });
});

export default router;
