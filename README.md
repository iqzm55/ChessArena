# ChessArena

Full-stack chess arena with paid matches, wallets, and an admin console. The frontend is Vite + React, and the backend is Node + Express + PostgreSQL with a WebSocket game server.

## Quick Start (Local)

**Prerequisites**
- Node.js 18+
- PostgreSQL 14+

### 1) Configure environment variables

**Backend** (required):
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your PostgreSQL connection string and a strong `JWT_SECRET`.

**Frontend** (optional for local, uses Vite proxy by default):
```bash
cp .env.development .env.local
```
Set `VITE_API_BASE_URL` / `VITE_WS_URL` only if you want to override the proxy.

### 2) Install dependencies
```bash
npm install
npm --prefix backend install
```

### 3) Start everything (one command)
```bash
npm run dev:full
```

The backend initializes tables automatically on first run and seeds an admin account if none exists. Defaults can be overridden via `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Database Initialization

On server boot, the backend loads `backend/db/schema.sql` and creates the required tables. If you want to force initialization manually:
```bash
npm --prefix backend run db:init
```

> **Note:** You still need a PostgreSQL database instance. Locally, create one named `chessarena` (or update `DATABASE_URL`). In Railway, add a PostgreSQL service and use its `DATABASE_URL`.

## Railway Deployment

### Backend service
1. Create a Railway service from the `backend` folder.
2. Add environment variables:
   - `DATABASE_URL` (from Railway Postgres)
   - `JWT_SECRET`
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` (first-run admin seed)
3. Build command:
   ```bash
   npm install && npm run build
   ```
4. Start command:
   ```bash
   npm start
   ```

### Frontend service
1. Create a Railway service from the repo root.
2. Add environment variables:
   - `VITE_API_BASE_URL=https://<backend-service-domain>`
   - `VITE_WS_URL=wss://<backend-service-domain>/ws`
3. Build command:
   ```bash
   npm install && npm run build
   ```
4. Start command:
   ```bash
   npm run preview -- --host 0.0.0.0 --port $PORT
   ```

## API Overview

### Auth
- `POST /api/auth/register` – `{ username, password }`
- `POST /api/auth/login` – `{ username, password }`
- `POST /signup` – `{ username, password }`
- `POST /login` – `{ username, password }`
- `GET /api/auth/me` – Bearer JWT

### Wallet (JWT required)
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `GET /api/wallet/deposit-addresses`
- `POST /api/wallet/deposit` – `{ cryptoType, amountUsd }`
- `POST /api/wallet/withdraw` – `{ amount, cryptoType, address }`

### Admin (JWT + admin role)
- `GET /api/admin/stats`
- `GET /api/admin/users`
- `POST /api/admin/users/:id/freeze` | `unfreeze` | `ban`
- `GET /api/admin/deposits` | `GET /api/admin/withdrawals`
- `POST /api/admin/deposits/:id/approve` | `reject`
- `POST /api/admin/withdrawals/:id/approve` | `reject`
- `GET /api/admin/games`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

### Games (public)
- `GET /api/games/modes`
- `GET /api/games/entry-fee/:mode`

### WebSocket `/ws?token=JWT`
- `join_game` – `{ type: 'join_game', mode: 'bullet-1' | 'blitz-3' | 'blitz-5' }`
- `move` – `{ type: 'move', move }`
- Server events: `game_start`, `game_resume`, `timer`, `move`, `game_end`, `error`, `matchmaking`

## Database Schema

Tables are defined in `backend/db/schema.sql`:
- `users` (auth + stats)
- `games`, `game_moves`, `game_escrow`
- `transactions` (deposits, withdrawals, game payouts)
- `app_wallet` (platform wallet + deposit addresses)
