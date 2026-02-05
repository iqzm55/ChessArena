import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { getAll, getOne, query, run } from '../db/index.js';
import { config } from '../config.js';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import type { UserRow, TransactionRow, AppWalletRow } from '../db/index.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function userRowToPublic(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    balance: row.wallet_balance,
    gamesPlayed: row.games_played,
    status: row.is_frozen ? 'frozen' : 'active',
    flagged: !!row.is_banned,
  };
}

/** GET /api/admin/stats */
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  const wallet = await getOne<{ balance: number }>('SELECT balance FROM app_wallet WHERE id = 1');
  const userCount = await getOne<{ c: number }>('SELECT COUNT(*)::int as c FROM users');
  const pendingDeposits = await getOne<{ c: number }>("SELECT COUNT(*)::int as c FROM transactions WHERE type = 'deposit' AND status = 'pending'");
  const flaggedGames = await getOne<{ c: number }>('SELECT COUNT(*)::int as c FROM games WHERE flagged = TRUE');
  res.json({
    appWalletBalance: wallet?.balance ?? 0,
    totalUsers: userCount?.c ?? 0,
    pendingDeposits: pendingDeposits?.c ?? 0,
    flaggedGames: flaggedGames?.c ?? 0,
  });
});

/** GET /api/admin/users */
router.get('/users', async (_req: AuthRequest, res: Response) => {
  const rows = await getAll<UserRow>('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC', ['player']);
  res.json({ users: rows.map(userRowToPublic) });
});

/** POST /api/admin/users/:id/freeze */
router.post('/users/:id/freeze', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await run('UPDATE users SET is_frozen = TRUE, updated_at = NOW() WHERE id = $1 AND role = $2', [id, 'player']);
  if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** POST /api/admin/users/:id/unfreeze */
router.post('/users/:id/unfreeze', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await run('UPDATE users SET is_frozen = FALSE, updated_at = NOW() WHERE id = $1 AND role = $2', [id, 'player']);
  if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** POST /api/admin/users/:id/ban */
router.post('/users/:id/ban', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await run('UPDATE users SET is_banned = TRUE, updated_at = NOW() WHERE id = $1 AND role = $2', [id, 'player']);
  if (r.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** GET /api/admin/deposits - pending deposits */
router.get('/deposits', async (_req: AuthRequest, res: Response) => {
  const rows = await getAll<(TransactionRow & { username: string })>(`
    SELECT t.*, u.username
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'deposit' AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `);
  res.json({
    deposits: rows.map((r) => ({
      id: r.id,
      user: r.username,
      amount: r.amount,
      crypto: (r.crypto_type || '').toUpperCase(),
      date: r.created_at,
      status: r.status,
    })),
  });
});

/** POST /api/admin/deposits/:id/approve */
router.post('/deposits/:id/approve', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const row = await getOne<TransactionRow>('SELECT * FROM transactions WHERE id = $1 AND type = $2 AND status = $3', [id, 'deposit', 'pending']);
  if (!row) return res.status(404).json({ error: 'Deposit not found or already processed' });
  const now = new Date().toISOString();
  await query('UPDATE transactions SET status = $1, processed_at = $2 WHERE id = $3', ['completed', now, id]);
  await query('UPDATE users SET wallet_balance = wallet_balance + $1, updated_at = NOW() WHERE id = $2', [row.amount, row.user_id]);
  res.json({ ok: true });
});

/** POST /api/admin/deposits/:id/reject */
router.post('/deposits/:id/reject', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await run('UPDATE transactions SET status = $1, processed_at = NOW() WHERE id = $2 AND type = $3 AND status = $4', ['rejected', id, 'deposit', 'pending']);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Deposit not found or already processed' });
  res.json({ ok: true });
});

/** GET /api/admin/withdrawals - pending withdrawals */
router.get('/withdrawals', async (_req: AuthRequest, res: Response) => {
  const rows = await getAll<(TransactionRow & { username: string })>(`
    SELECT t.*, u.username
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'withdrawal' AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `);
  res.json({
    withdrawals: rows.map((r) => ({
      id: r.id,
      user: r.username,
      amount: Math.abs(r.amount),
      crypto: (r.crypto_type || '').toUpperCase(),
      address: r.crypto_address || '',
      date: r.created_at,
      status: r.status,
    })),
  });
});

/** POST /api/admin/withdrawals/:id/approve */
router.post('/withdrawals/:id/approve', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const row = await getOne<TransactionRow>('SELECT * FROM transactions WHERE id = $1 AND type = $2 AND status = $3', [id, 'withdrawal', 'pending']);
  if (!row) return res.status(404).json({ error: 'Withdrawal not found or already processed' });
  const amount = Math.abs(row.amount);
  const fee = config.withdrawalFee;
  const total = amount + fee;
  const user = await getOne<{ wallet_balance: number }>('SELECT wallet_balance FROM users WHERE id = $1', [row.user_id]);
  if ((user?.wallet_balance ?? 0) < total) {
    return res.status(400).json({ error: 'User has insufficient balance' });
  }
  const now = new Date().toISOString();
  await query('UPDATE transactions SET status = $1, processed_at = $2 WHERE id = $3', ['completed', now, id]);
  await query('UPDATE users SET wallet_balance = wallet_balance - $1, updated_at = NOW() WHERE id = $2', [total, row.user_id]);
  await query('UPDATE app_wallet SET balance = balance + $1, updated_at = NOW() WHERE id = 1', [fee]);
  res.json({ ok: true });
});

/** POST /api/admin/withdrawals/:id/reject */
router.post('/withdrawals/:id/reject', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await run('UPDATE transactions SET status = $1, processed_at = NOW() WHERE id = $2 AND type = $3 AND status = $4', ['rejected', id, 'withdrawal', 'pending']);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Withdrawal not found or already processed' });
  res.json({ ok: true });
});

/** GET /api/admin/games */
router.get('/games', async (_req: AuthRequest, res: Response) => {
  const rows = await getAll<{ id: string; mode: string; status: string; flagged: boolean; flag_reason: string | null; result: string | null; white: string | null; black: string | null }>(`
    SELECT g.id, g.mode, g.status, g.flagged, g.flag_reason, g.result,
           w.username as white, b.username as black
    FROM games g
    LEFT JOIN users w ON w.id = g.white_user_id
    LEFT JOIN users b ON b.id = g.black_user_id
    ORDER BY g.created_at DESC
    LIMIT 100
  `);
  res.json({
    games: rows.map((r) => ({
      id: r.id,
      white: r.white ?? '-',
      black: r.black ?? '-',
      mode: r.mode,
      status: r.status,
      flagged: !!r.flagged,
      reason: r.flag_reason ?? undefined,
      result: r.result ?? undefined,
    })),
  });
});

/** GET /api/admin/settings - wallet addresses */
router.get('/settings', async (_req: AuthRequest, res: Response) => {
  const row = await getOne<AppWalletRow>('SELECT * FROM app_wallet WHERE id = 1');
  const w = row ?? { btc_address: null, eth_address: null, usdt_address: null } as AppWalletRow;
  res.json({
    walletAddresses: {
      btc: w.btc_address ?? '',
      eth: w.eth_address ?? '',
      usdt: w.usdt_address ?? '',
    },
  });
});

/** PUT /api/admin/settings - update wallet addresses */
router.put('/settings', async (req: AuthRequest, res: Response) => {
  const { btc, eth, usdt } = req.body?.walletAddresses ?? {};
  await query(`
    UPDATE app_wallet SET btc_address = $1, eth_address = $2, usdt_address = $3, updated_at = NOW() WHERE id = 1
  `, [
    typeof btc === 'string' ? btc : null,
    typeof eth === 'string' ? eth : null,
    typeof usdt === 'string' ? usdt : null,
  ]);
  res.json({ ok: true });
});

export default router;
