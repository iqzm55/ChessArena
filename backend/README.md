# Chess Crypto Backend

Node.js + Express backend for the paid multiplayer chess app. SQLite, JWT auth, WebSockets, wallet, admin approval for deposits/withdrawals, server-authoritative chess with anti-cheat.

## Setup

```bash
cd backend
npm install
npm run db:init   # creates DB and default admin (admin / admin123)
npm run dev       # start dev server (tsx watch)
```

## Environment

- `PORT` – server port (default 3001)
- `JWT_SECRET` – secret for JWT (set in production)
- `DATABASE_PATH` – path to SQLite file (default: `db/chesscrypto.db`)

## API Overview

### Auth
- `POST /api/auth/register` – `{ username, password }` → `{ user, token, isAdmin }`
- `POST /api/auth/login` – `{ username, password }` → `{ user, token, isAdmin }`
- `GET /api/auth/me` – Bearer JWT → `{ user, isAdmin }`

### Wallet (JWT required)
- `GET /api/wallet/balance` → `{ balance }`
- `GET /api/wallet/transactions` → `{ transactions }`
- `GET /api/wallet/deposit-addresses` → `{ btc, eth, usdt }`
- `POST /api/wallet/deposit` – `{ cryptoType, amountUsd }` → pending deposit + address
- `POST /api/wallet/withdraw` – `{ amount, cryptoType, address }` → pending withdrawal

### Admin (JWT + admin role)
- `GET /api/admin/stats` – app wallet, user count, pending counts
- `GET /api/admin/users` – list users
- `POST /api/admin/users/:id/freeze` | `unfreeze` | `ban`
- `GET /api/admin/deposits` | `GET /api/admin/withdrawals`
- `POST /api/admin/deposits/:id/approve` | `reject`
- `POST /api/admin/withdrawals/:id/approve` | `reject`
- `GET /api/admin/games` – games list
- `GET /api/admin/settings` – wallet addresses
- `PUT /api/admin/settings` – `{ walletAddresses: { btc, eth, usdt } }`

### Games (public)
- `GET /api/games/modes` → `{ modes }` (entry fee, time control)
- `GET /api/games/entry-fee/:mode` → `{ mode, entryFee }`

## WebSocket `/ws?token=JWT`

- **join_game** – `{ type: 'join_game', mode: 'bullet-1' | 'blitz-3' | 'blitz-5' }` – matchmaking
- **move** – `{ type: 'move', move: Move }` – server validates and broadcasts
- Server sends: `game_start`, `timer`, `move`, `game_end`, `error`, `matchmaking`

Payouts: win = entry + 50% of opponent; draw = 90% back; loss = 0. Anti-cheat: invalid move → game flagged, cheater frozen, balance confiscated to app wallet.
