import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getDb } from './db/index.js';
import { config, GAME_MODES, type GameMode } from './config.js';
import { createInitialGameState, makeMove, getLegalMoves } from './lib/chess/engine.js';
import type { GameState, Move } from './lib/chess/types.js';
import type { UserRow } from './db/index.js';

interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

interface QueuedPlayer {
  userId: string;
  username: string;
  socket: WebSocket;
  mode: GameMode;
  joinedAt: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

interface GameSession {
  id: string;
  mode: GameMode;
  whiteUserId: string;
  blackUserId: string;
  whiteUsername: string;
  blackUsername: string;
  whiteDisplayName: string;
  blackDisplayName: string;
  whiteAvatar: string | null;
  blackAvatar: string | null;
  whiteSocket: WebSocket | null;
  blackSocket: WebSocket | null;
  gameState: GameState;
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  entryFee: number;
  status: 'playing' | 'finished';
  result?: 'white' | 'black' | 'draw';
  timerInterval?: ReturnType<typeof setInterval>;
  startedAt: number;
  disconnected: { white: boolean; black: boolean };
  disconnectTimers: { white?: ReturnType<typeof setTimeout>; black?: ReturnType<typeof setTimeout> };
}

const matchmakingQueues = new Map<GameMode, QueuedPlayer[]>();
const activeGames = new Map<string, GameSession>();
const socketToGame = new Map<WebSocket, string>();
const socketToUserId = new Map<WebSocket, string>();
const userToGame = new Map<string, string>();

const MATCHMAKING_TIMEOUT_MS = 15000;
const RECONNECT_GRACE_MS = 30000;

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function parseToken(url: string): JwtPayload | null {
  try {
    const u = new URL(url, 'http://localhost');
    const token = u.searchParams.get('token');
    if (!token) return null;
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

function send(ws: WebSocket | null, type: string, payload: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, ...payload }));
}

function broadcast(session: GameSession, type: string, payload: unknown) {
  send(session.whiteSocket, type, payload);
  send(session.blackSocket, type, payload);
}

function currentTurnPlayerId(session: GameSession): string {
  return session.gameState.turn === 'white' ? session.whiteUserId : session.blackUserId;
}

function currentTurnPayload(session: GameSession) {
  return {
    currentTurn: session.gameState.turn,
    currentTurnPlayerId: currentTurnPlayerId(session),
  };
}

function endGame(session: GameSession, result: 'white' | 'black' | 'draw', reason: string) {
  if (session.status === 'finished') return;
  session.status = 'finished';
  session.result = result;
  if (session.timerInterval) {
    clearInterval(session.timerInterval);
    session.timerInterval = undefined;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const entryFee = session.entryFee;
  const pot = roundMoney(entryFee * 2);
  const platformFee = result === 'draw' ? 0 : roundMoney(pot * config.platformFeeRate);
  const winnerPayout = result === 'draw' ? entryFee : roundMoney(pot - platformFee);
  const whitePayout = result === 'white' ? winnerPayout : result === 'draw' ? entryFee : 0;
  const blackPayout = result === 'black' ? winnerPayout : result === 'draw' ? entryFee : 0;

  const applyEnd = db.transaction(() => {
    db.prepare(`
      UPDATE games
      SET status = 'finished',
          result = ?,
          ended_at = ?,
          game_state_json = ?,
          white_payout = ?,
          black_payout = ?,
          platform_fee = ?
      WHERE id = ?
    `).run(result, now, JSON.stringify(session.gameState), whitePayout, blackPayout, platformFee, session.id);

    db.prepare(`
      UPDATE game_escrow
      SET status = ?, released_at = ?
      WHERE game_id = ?
    `).run(result === 'draw' ? 'refunded' : 'released', now, session.id);

    db.prepare('UPDATE users SET games_played = games_played + 1, updated_at = datetime(\'now\') WHERE id IN (?, ?)').run(session.whiteUserId, session.blackUserId);
    if (result === 'white') {
      db.prepare('UPDATE users SET games_won = games_won + 1 WHERE id = ?').run(session.whiteUserId);
      db.prepare('UPDATE users SET games_lost = games_lost + 1 WHERE id = ?').run(session.blackUserId);
    } else if (result === 'black') {
      db.prepare('UPDATE users SET games_won = games_won + 1 WHERE id = ?').run(session.blackUserId);
      db.prepare('UPDATE users SET games_lost = games_lost + 1 WHERE id = ?').run(session.whiteUserId);
    } else {
      db.prepare('UPDATE users SET games_draw = games_draw + 1 WHERE id = ?').run(session.whiteUserId);
      db.prepare('UPDATE users SET games_draw = games_draw + 1 WHERE id = ?').run(session.blackUserId);
    }

    if (whitePayout > 0) {
      db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(whitePayout, session.whiteUserId);
    }
    if (blackPayout > 0) {
      db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(blackPayout, session.blackUserId);
    }

    if (platformFee > 0) {
      db.prepare('UPDATE app_wallet SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = 1').run(platformFee);
    }

    const txIdW = randomUUID();
    const txIdB = randomUUID();
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, created_at, processed_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?)
    `).run(txIdW, session.whiteUserId, result === 'draw' ? 'game_draw' : result === 'white' ? 'game_win' : 'game_loss', whitePayout, now, now);
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, created_at, processed_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?)
    `).run(txIdB, session.blackUserId, result === 'draw' ? 'game_draw' : result === 'black' ? 'game_win' : 'game_loss', blackPayout, now, now);

    const whiteEarnings = Math.max(0, whitePayout - entryFee);
    const blackEarnings = Math.max(0, blackPayout - entryFee);
    if (whiteEarnings > 0) {
      db.prepare('UPDATE users SET total_earnings = total_earnings + ? WHERE id = ?').run(whiteEarnings, session.whiteUserId);
    }
    if (blackEarnings > 0) {
      db.prepare('UPDATE users SET total_earnings = total_earnings + ? WHERE id = ?').run(blackEarnings, session.blackUserId);
    }
  });

  applyEnd();

  const whiteDelta = roundMoney(whitePayout - entryFee);
  const blackDelta = roundMoney(blackPayout - entryFee);
  const payload = {
    reason,
    gameState: session.gameState,
    winnerUserId: result === 'white' ? session.whiteUserId : result === 'black' ? session.blackUserId : null,
    loserUserId: result === 'white' ? session.blackUserId : result === 'black' ? session.whiteUserId : null,
    draw: result === 'draw',
    payouts: {
      white: whitePayout,
      black: blackPayout,
      platformFee,
      totalPot: pot,
    },
    ...currentTurnPayload(session),
  };

  send(session.whiteSocket, 'game_end', {
    result: result === 'white' ? 'win' : result === 'black' ? 'loss' : 'draw',
    moneyChange: whiteDelta,
    ...payload,
  });
  send(session.blackSocket, 'game_end', {
    result: result === 'black' ? 'win' : result === 'white' ? 'loss' : 'draw',
    moneyChange: blackDelta,
    ...payload,
  });

  if (session.whiteSocket) {
    socketToGame.delete(session.whiteSocket);
    socketToUserId.delete(session.whiteSocket);
  }
  if (session.blackSocket) {
    socketToGame.delete(session.blackSocket);
    socketToUserId.delete(session.blackSocket);
  }
  userToGame.delete(session.whiteUserId);
  userToGame.delete(session.blackUserId);
  activeGames.delete(session.id);
}

function tickTimer(session: GameSession) {
  const turn = session.gameState.turn;
  if (turn === 'white') {
    session.whiteTimeRemaining--;
    if (session.whiteTimeRemaining <= 0) {
      endGame(session, 'black', 'White ran out of time');
      return;
    }
  } else {
    session.blackTimeRemaining--;
    if (session.blackTimeRemaining <= 0) {
      endGame(session, 'white', 'Black ran out of time');
      return;
    }
  }
  broadcast(session, 'timer', {
    whiteTime: session.whiteTimeRemaining,
    blackTime: session.blackTimeRemaining,
    ...currentTurnPayload(session),
  });
}

function tryMatch(session: GameSession) {
  const db = getDb();
  const gameId = randomUUID();
  const now = new Date().toISOString();
  const cfg = GAME_MODES[session.mode];
  const startMatch = db.transaction(() => {
    const white = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(session.whiteUserId) as { wallet_balance: number } | undefined;
    const black = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(session.blackUserId) as { wallet_balance: number } | undefined;
    if (!white || !black || white.wallet_balance < cfg.entryFee || black.wallet_balance < cfg.entryFee) {
      throw new Error('Insufficient balance');
    }

    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(cfg.entryFee, session.whiteUserId);
    db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(cfg.entryFee, session.blackUserId);

    const txIdW = randomUUID();
    const txIdB = randomUUID();
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, created_at, processed_at)
      VALUES (?, ?, 'game_entry', ?, 'completed', ?, ?)
    `).run(txIdW, session.whiteUserId, -cfg.entryFee, now, now);
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, created_at, processed_at)
      VALUES (?, ?, 'game_entry', ?, 'completed', ?, ?)
    `).run(txIdB, session.blackUserId, -cfg.entryFee, now, now);

    db.prepare(`
      INSERT INTO games (id, mode, white_user_id, black_user_id, status, game_state_json, white_time_remaining, black_time_remaining, entry_fee, started_at, created_at)
      VALUES (?, ?, ?, ?, 'playing', ?, ?, ?, ?, ?, ?)
    `).run(
      gameId,
      session.mode,
      session.whiteUserId,
      session.blackUserId,
      JSON.stringify(session.gameState),
      session.whiteTimeRemaining,
      session.blackTimeRemaining,
      session.entryFee,
      now,
      now
    );

    db.prepare(`
      INSERT INTO game_escrow (game_id, white_user_id, black_user_id, entry_fee, total_amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'held', ?)
    `).run(gameId, session.whiteUserId, session.blackUserId, cfg.entryFee, roundMoney(cfg.entryFee * 2), now);
  });

  try {
    startMatch();
  } catch (error) {
    send(session.whiteSocket, 'error', { message: error instanceof Error ? error.message : 'Match failed' });
    send(session.blackSocket, 'error', { message: error instanceof Error ? error.message : 'Match failed' });
    return;
  }

  session.id = gameId;
  activeGames.set(gameId, session);
  if (session.whiteSocket) {
    socketToGame.set(session.whiteSocket, gameId);
    socketToUserId.set(session.whiteSocket, session.whiteUserId);
  }
  if (session.blackSocket) {
    socketToGame.set(session.blackSocket, gameId);
    socketToUserId.set(session.blackSocket, session.blackUserId);
  }
  userToGame.set(session.whiteUserId, gameId);
  userToGame.set(session.blackUserId, gameId);

  const whitePlayer = { id: session.whiteUserId, username: session.whiteUsername, displayName: session.whiteDisplayName, avatar: session.whiteAvatar };
  const blackPlayer = { id: session.blackUserId, username: session.blackUsername, displayName: session.blackDisplayName, avatar: session.blackAvatar };

  send(session.whiteSocket, 'game_start', {
    gameId,
    mode: session.mode,
    playerColor: 'white',
    whitePlayer,
    blackPlayer,
    gameState: session.gameState,
    whiteTime: session.whiteTimeRemaining,
    blackTime: session.blackTimeRemaining,
    ...currentTurnPayload(session),
  });
  send(session.blackSocket, 'game_start', {
    gameId,
    mode: session.mode,
    playerColor: 'black',
    whitePlayer,
    blackPlayer,
    gameState: session.gameState,
    whiteTime: session.whiteTimeRemaining,
    blackTime: session.blackTimeRemaining,
    ...currentTurnPayload(session),
  });

  session.timerInterval = setInterval(() => tickTimer(session), 1000);
}

function handleJoinGame(ws: WebSocket, userId: string, username: string, mode: GameMode) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user || user.is_banned || user.is_frozen) {
    send(ws, 'error', { message: 'Account not allowed to play' });
    return;
  }
  const cfg = GAME_MODES[mode];
  if (!cfg) {
    send(ws, 'error', { message: 'Invalid game mode' });
    return;
  }
  const existingGameId = userToGame.get(userId);
  if (existingGameId) {
    const session = activeGames.get(existingGameId);
    if (session && session.status === 'playing') {
      attachSocketToSession(ws, userId, session);
      sendGameResume(ws, session, userId);
      return;
    }
  }
  if (user.wallet_balance < cfg.entryFee) {
    send(ws, 'error', { message: 'Insufficient balance' });
    return;
  }

  const queue = matchmakingQueues.get(mode) ?? [];
  if (queue.some((p) => p.userId === userId)) {
    send(ws, 'matchmaking', { mode, status: 'waiting', message: 'Waiting for opponent...' });
    return;
  }
  const other = queue.find((p) => p.userId !== userId);
  if (other) {
    matchmakingQueues.set(mode, queue.filter((p) => p.userId !== other.userId && p.userId !== userId));
    if (other.timeoutId) clearTimeout(other.timeoutId);

    const db2 = getDb();
    const otherUser = db2.prepare('SELECT * FROM users WHERE id = ?').get(other.userId) as UserRow | undefined;
    if (!otherUser || otherUser.is_banned || otherUser.is_frozen || otherUser.wallet_balance < cfg.entryFee) {
      send(other.socket, 'error', { message: 'Match cancelled' });
      send(ws, 'error', { message: 'Match cancelled' });
      return;
    }

    const gameState = createInitialGameState();
    const session: GameSession = {
      id: '',
      mode,
      whiteUserId: userId,
      blackUserId: other.userId,
      whiteUsername: username,
      blackUsername: other.username,
      whiteDisplayName: user.display_name ?? user.username,
      blackDisplayName: otherUser.display_name ?? otherUser.username,
      whiteAvatar: user.avatar_url ?? null,
      blackAvatar: otherUser.avatar_url ?? null,
      whiteSocket: ws,
      blackSocket: other.socket,
      gameState,
      whiteTimeRemaining: cfg.timeControl,
      blackTimeRemaining: cfg.timeControl,
      entryFee: cfg.entryFee,
      status: 'playing',
      startedAt: Date.now(),
      disconnected: { white: false, black: false },
      disconnectTimers: {},
    };
    tryMatch(session);
  } else {
    const entry: QueuedPlayer = { userId, username, socket: ws, mode, joinedAt: Date.now() };
    entry.timeoutId = setTimeout(() => {
      const existing = matchmakingQueues.get(mode) ?? [];
      const idx = existing.findIndex((p) => p.userId === userId);
      if (idx >= 0) {
        matchmakingQueues.set(mode, existing.filter((p) => p.userId !== userId));
        send(ws, 'matchmaking', { mode, status: 'no_opponent', message: 'No opponent available' });
      }
    }, MATCHMAKING_TIMEOUT_MS);
    matchmakingQueues.set(mode, [...queue, entry]);
    send(ws, 'matchmaking', { mode, status: 'waiting', message: 'Waiting for opponent...' });
  }
}

function handleMove(ws: WebSocket, move: Move) {
  const gameId = socketToGame.get(ws);
  if (!gameId) {
    send(ws, 'error', { message: 'Not in a game' });
    return;
  }
  const session = activeGames.get(gameId);
  if (!session || session.status !== 'playing') return;
  const userId = socketToUserId.get(ws);
  if (!userId) {
    send(ws, 'error', { message: 'Not authenticated' });
    return;
  }
  const isWhite = userId === session.whiteUserId;
  const currentTurn = session.gameState.turn;
  if ((currentTurn === 'white' && !isWhite) || (currentTurn === 'black' && isWhite)) {
    send(ws, 'error', { message: 'Not your turn' });
    return;
  }
  const legalMoves = getLegalMoves(session.gameState, move.from);
  const selectedMove = legalMoves.find(
    (m) => m.from === move.from && m.to === move.to && (m.promotion ?? null) === (move.promotion ?? null) && (m.isCastling ?? null) === (move.isCastling ?? null) && (m.isEnPassant ?? null) === (move.isEnPassant ?? null)
  );
  if (!selectedMove) {
    const db = getDb();
    const cheaterId = isWhite ? session.whiteUserId : session.blackUserId;
    db.prepare('UPDATE games SET flagged = 1, flag_reason = ? WHERE id = ?').run('Invalid move (anti-cheat)', gameId);
    const cheaterRow = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(cheaterId) as { wallet_balance: number } | undefined;
    const confiscate = cheaterRow?.wallet_balance ?? 0;
    db.prepare('UPDATE users SET is_frozen = 1, wallet_balance = 0, updated_at = datetime(\'now\') WHERE id = ?').run(cheaterId);
    if (confiscate > 0) {
      db.prepare('UPDATE app_wallet SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = 1').run(confiscate);
    }
    const txId = randomUUID();
    db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, status, created_at, processed_at)
      VALUES (?, ?, 'cheat_forfeit', ?, 'completed', datetime('now'), datetime('now'))
    `).run(txId, cheaterId, -confiscate);
    endGame(session, isWhite ? 'black' : 'white', 'Cheat detected - opponent forfeited');
    return;
  }
  const newState = makeMove(session.gameState, selectedMove);
  session.gameState = newState;

  const db = getDb();
  db.prepare(`
    INSERT INTO game_moves (game_id, move_number, from_square, to_square, piece_type, piece_color, captured_type, promotion_type, is_castling, is_en_passant)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    gameId,
    newState.moveHistory.length,
    selectedMove.from,
    selectedMove.to,
    selectedMove.piece.type,
    selectedMove.piece.color,
    selectedMove.captured?.type ?? null,
    selectedMove.promotion ?? null,
    selectedMove.isCastling ?? null,
    selectedMove.isEnPassant ? 1 : 0
  );
  db.prepare('UPDATE games SET game_state_json = ? WHERE id = ?').run(JSON.stringify(newState), gameId);

  broadcast(session, 'move', { move: selectedMove, gameState: newState, ...currentTurnPayload(session) });

  if (newState.isCheckmate) {
    const winner = selectedMove.piece.color;
    endGame(session, winner, 'Checkmate');
  } else if (newState.isStalemate) {
    endGame(session, 'draw', 'Stalemate');
  } else if (newState.isDraw) {
    endGame(session, 'draw', '50-move rule');
  }
}

export function setupWebSocketServer(server: import('http').Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? '';
    const payload = parseToken(url);
    if (!payload) {
      send(ws, 'error', { message: 'Invalid or missing token' });
      ws.close();
      return;
    }

    socketToUserId.set(ws, payload.userId);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; mode?: GameMode; move?: Move };
        if (msg.type === 'join_game' && msg.mode) {
          handleJoinGame(ws, payload.userId, payload.username, msg.mode);
        } else if (msg.type === 'cancel_matchmaking') {
          cancelMatchmaking(payload.userId, ws);
        } else if (msg.type === 'move' && msg.move) {
          handleMove(ws, msg.move);
        }
      } catch {
        send(ws, 'error', { message: 'Invalid message' });
      }
    });

    ws.on('close', () => {
      const gameId = socketToGame.get(ws);
      if (gameId) {
        const session = activeGames.get(gameId);
        if (session && session.status === 'playing') {
          if (session.whiteSocket === ws) {
            markDisconnected(session, 'white');
          } else if (session.blackSocket === ws) {
            markDisconnected(session, 'black');
          }
        }
      }
      const userId = socketToUserId.get(ws);
      if (userId) {
        cancelMatchmaking(userId, ws, false);
      }
      socketToGame.delete(ws);
      socketToUserId.delete(ws);
    });
  });
}

function cancelMatchmaking(userId: string, ws: WebSocket, notify = true) {
  for (const [mode, queue] of matchmakingQueues) {
    const idx = queue.findIndex((p) => p.userId === userId);
    if (idx >= 0) {
      const entry = queue[idx];
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      matchmakingQueues.set(mode, queue.filter((_, i) => i !== idx));
      if (notify) {
        send(ws, 'matchmaking', { mode, status: 'cancelled', message: 'Matchmaking cancelled' });
      }
      return;
    }
  }
}

function markDisconnected(session: GameSession, color: 'white' | 'black') {
  session.disconnected[color] = true;
  const timerKey = color === 'white' ? 'white' : 'black';
  if (session.disconnectTimers[timerKey]) {
    clearTimeout(session.disconnectTimers[timerKey]);
  }
  session.disconnectTimers[timerKey] = setTimeout(() => {
    if (session.status !== 'playing') return;
    const winner = color === 'white' ? 'black' : 'white';
    endGame(session, winner, 'Opponent disconnected');
  }, RECONNECT_GRACE_MS);
}

function attachSocketToSession(ws: WebSocket, userId: string, session: GameSession) {
  if (userId === session.whiteUserId) {
    session.whiteSocket = ws;
    session.disconnected.white = false;
    if (session.disconnectTimers.white) clearTimeout(session.disconnectTimers.white);
  } else if (userId === session.blackUserId) {
    session.blackSocket = ws;
    session.disconnected.black = false;
    if (session.disconnectTimers.black) clearTimeout(session.disconnectTimers.black);
  }
  socketToGame.set(ws, session.id);
  socketToUserId.set(ws, userId);
}

function sendGameResume(ws: WebSocket, session: GameSession, userId: string) {
  const whitePlayer = { id: session.whiteUserId, username: session.whiteUsername, displayName: session.whiteDisplayName, avatar: session.whiteAvatar };
  const blackPlayer = { id: session.blackUserId, username: session.blackUsername, displayName: session.blackDisplayName, avatar: session.blackAvatar };
  const playerColor = userId === session.whiteUserId ? 'white' : 'black';
  send(ws, 'game_resume', {
    gameId: session.id,
    mode: session.mode,
    playerColor,
    whitePlayer,
    blackPlayer,
    gameState: session.gameState,
    whiteTime: session.whiteTimeRemaining,
    blackTime: session.blackTimeRemaining,
    ...currentTurnPayload(session),
  });
}
