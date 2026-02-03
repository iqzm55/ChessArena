import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
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
router.get('/stats', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const wallet = db.prepare('SELECT balance FROM app_wallet WHERE id = 1').get() as { balance: number };
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  const pendingDeposits = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE type = 'deposit' AND status = 'pending'").get() as { c: number };
  const flaggedGames = db.prepare('SELECT COUNT(*) as c FROM games WHERE flagged = 1').get() as { c: number };
  res.json({
    appWalletBalance: wallet.balance,
    totalUsers: userCount.c,
    pendingDeposits: pendingDeposits.c,
    flaggedGames: flaggedGames.c,
  });
});

/** GET /api/admin/users */
router.get('/users', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all('player') as UserRow[];
  res.json({ users: rows.map(userRowToPublic) });
});

/** POST /api/admin/users/:id/freeze */
router.post('/users/:id/freeze', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const r = db.prepare('UPDATE users SET is_frozen = 1, updated_at = datetime(\'now\') WHERE id = ? AND role = ?').run(id, 'player');
  if (r.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** POST /api/admin/users/:id/unfreeze */
router.post('/users/:id/unfreeze', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const r = db.prepare('UPDATE users SET is_frozen = 0, updated_at = datetime(\'now\') WHERE id = ? AND role = ?').run(id, 'player');
  if (r.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** POST /api/admin/users/:id/ban */
router.post('/users/:id/ban', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const r = db.prepare('UPDATE users SET is_banned = 1, updated_at = datetime(\'now\') WHERE id = ? AND role = ?').run(id, 'player');
  if (r.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

/** GET /api/admin/deposits - pending deposits */
router.get('/deposits', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, u.username
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'deposit' AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `).all() as (TransactionRow & { username: string })[];
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
router.post('/deposits/:id/approve', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND type = ? AND status = ?').get(id, 'deposit', 'pending') as TransactionRow | undefined;
  if (!row) return res.status(404).json({ error: 'Deposit not found or already processed' });
  const now = new Date().toISOString();
  db.prepare('UPDATE transactions SET status = ?, processed_at = ? WHERE id = ?').run('completed', now, id);
  db.prepare('UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = datetime(\'now\') WHERE id = ?').run(row.amount, row.user_id);
  res.json({ ok: true });
});

/** POST /api/admin/deposits/:id/reject */
router.post('/deposits/:id/reject', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const r = db.prepare('UPDATE transactions SET status = ?, processed_at = datetime(\'now\') WHERE id = ? AND type = ? AND status = ?').run('rejected', id, 'deposit', 'pending');
  if (r.changes === 0) return res.status(404).json({ error: 'Deposit not found or already processed' });
  res.json({ ok: true });
});

/** GET /api/admin/withdrawals - pending withdrawals */
router.get('/withdrawals', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, u.username
    FROM transactions t
    JOIN users u ON u.id = t.user_id
    WHERE t.type = 'withdrawal' AND t.status = 'pending'
    ORDER BY t.created_at DESC
  `).all() as (TransactionRow & { username: string })[];
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
router.post('/withdrawals/:id/approve', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND type = ? AND status = ?').get(id, 'withdrawal', 'pending') as TransactionRow | undefined;
  if (!row) return res.status(404).json({ error: 'Withdrawal not found or already processed' });
  const amount = Math.abs(row.amount);
  const fee = config.withdrawalFee;
  const total = amount + fee;
  const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(row.user_id) as { wallet_balance: number };
  if (user.wallet_balance < total) {
    return res.status(400).json({ error: 'User has insufficient balance' });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE transactions SET status = ?, processed_at = ? WHERE id = ?').run('completed', now, id);
  db.prepare('UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = datetime(\'now\') WHERE id = ?').run(total, row.user_id);
  db.prepare('UPDATE app_wallet SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = 1').run(fee);
  res.json({ ok: true });
});

/** POST /api/admin/withdrawals/:id/reject */
router.post('/withdrawals/:id/reject', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const r = db.prepare('UPDATE transactions SET status = ?, processed_at = datetime(\'now\') WHERE id = ? AND type = ? AND status = ?').run('rejected', id, 'withdrawal', 'pending');
  if (r.changes === 0) return res.status(404).json({ error: 'Withdrawal not found or already processed' });
  res.json({ ok: true });
});

/** GET /api/admin/games */
router.get('/games', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT g.id, g.mode, g.status, g.flagged, g.flag_reason, g.result,
           w.username as white, b.username as black
    FROM games g
    LEFT JOIN users w ON w.id = g.white_user_id
    LEFT JOIN users b ON b.id = g.black_user_id
    ORDER BY g.created_at DESC
    LIMIT 100
  `).all() as { id: string; mode: string; status: string; flagged: number; flag_reason: string | null; result: string | null; white: string | null; black: string | null }[];
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
router.get('/settings', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM app_wallet WHERE id = 1').get() as AppWalletRow;
  res.json({
    walletAddresses: {
      btc: row.btc_address ?? '',
      eth: row.eth_address ?? '',
      usdt: row.usdt_address ?? '',
    },
  });
});

/** PUT /api/admin/settings - update wallet addresses */
router.put('/settings', (req: AuthRequest, res: Response) => {
  const { btc, eth, usdt } = req.body?.walletAddresses ?? {};
  const db = getDb();
  db.prepare(`
    UPDATE app_wallet SET btc_address = ?, eth_address = ?, usdt_address = ?, updated_at = datetime('now') WHERE id = 1
  `).run(
    typeof btc === 'string' ? btc : null,
    typeof eth === 'string' ? eth : null,
    typeof usdt === 'string' ? usdt : null
  );
  res.json({ ok: true });
});

export default router;
