import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import type { TransactionRow } from '../db/index.js';

const router = Router();
const WITHDRAWAL_FEE = config.withdrawalFee;

/** GET /api/wallet/balance */
router.get('/balance', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ balance: req.user.wallet_balance });
});

/** GET /api/wallet/deposit-addresses - public deposit addresses for BTC/ETH/USDT */
router.get('/deposit-addresses', requireAuth, (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT btc_address, eth_address, usdt_address FROM app_wallet WHERE id = 1').get() as {
    btc_address: string | null;
    eth_address: string | null;
    usdt_address: string | null;
  };
  res.json({
    btc: row?.btc_address ?? '',
    eth: row?.eth_address ?? '',
    usdt: row?.usdt_address ?? '',
  });
});

/** GET /api/wallet/transactions */
router.get('/transactions', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(req.user.id) as TransactionRow[];
  const list = rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: r.amount,
    cryptoType: r.crypto_type,
    cryptoAddress: r.crypto_address,
    status: r.status,
    createdAt: r.created_at,
    processedAt: r.processed_at,
  }));
  res.json({ transactions: list });
});

/** POST /api/wallet/deposit - submit manual deposit (user says "I've sent the payment") */
router.post('/deposit', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.is_frozen) {
    return res.status(403).json({ error: 'Account frozen' });
  }
  const { cryptoType, amountUsd } = req.body as { cryptoType?: string; amountUsd?: number };
  const crypto = typeof cryptoType === 'string' && ['btc', 'eth', 'usdt'].includes(cryptoType) ? cryptoType : null;
  const amount = typeof amountUsd === 'number' && amountUsd > 0 ? amountUsd : parseFloat(String(amountUsd));
  if (!crypto || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid cryptoType (btc|eth|usdt) and positive amountUsd required' });
  }

  const db = getDb();
  const wallet = db.prepare('SELECT * FROM app_wallet WHERE id = 1').get() as { btc_address: string | null; eth_address: string | null; usdt_address: string | null };
  const address = wallet.btc_address && crypto === 'btc' ? wallet.btc_address
    : wallet.eth_address && crypto === 'eth' ? wallet.eth_address
    : wallet.usdt_address && crypto === 'usdt' ? wallet.usdt_address
    : null;
  if (!address) {
    return res.status(503).json({ error: 'Deposit address not configured for this crypto' });
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, crypto_type, status)
    VALUES (?, ?, 'deposit', ?, ?, 'pending')
  `).run(id, req.user.id, amount, crypto);

  res.status(201).json({
    depositId: id,
    amountUsd: amount,
    cryptoType: crypto,
    address,
    status: 'pending',
  });
});

/** POST /api/wallet/withdraw - request withdrawal (admin approves later) */
router.post('/withdraw', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.is_frozen) {
    return res.status(403).json({ error: 'Account frozen' });
  }
  const { amount, cryptoType, address } = req.body as { amount?: number; cryptoType?: string; address?: string };
  const crypto = typeof cryptoType === 'string' && ['btc', 'eth', 'usdt'].includes(cryptoType) ? cryptoType : 'usdt';
  const amt = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const destAddress = typeof address === 'string' ? address.trim() : '';

  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Valid positive amount required' });
  }
  if (destAddress.length < 10) {
    return res.status(400).json({ error: 'Valid wallet address required' });
  }
  const total = amt + WITHDRAWAL_FEE;
  if (req.user.wallet_balance < total) {
    return res.status(400).json({ error: 'Insufficient balance (including withdrawal fee)' });
  }
  if (req.user.games_played < 1) {
    return res.status(400).json({ error: 'Play at least 1 game before withdrawing' });
  }

  const id = randomUUID();
  const db = getDb();
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, crypto_type, crypto_address, status)
    VALUES (?, ?, 'withdrawal', ?, ?, ?, 'pending')
  `).run(id, req.user.id, -amt, crypto, destAddress);

  res.status(201).json({
    withdrawalId: id,
    amount: amt,
    fee: WITHDRAWAL_FEE,
    cryptoType: crypto,
    address: destAddress,
    status: 'pending',
  });
});

export default router;
