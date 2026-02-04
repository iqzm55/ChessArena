-- Chess Crypto Backend - PostgreSQL Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'player')),
    display_name TEXT,
    avatar_url TEXT,
    wallet_balance NUMERIC NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    games_lost INTEGER NOT NULL DEFAULT 0,
    games_draw INTEGER NOT NULL DEFAULT 0,
    total_earnings NUMERIC NOT NULL DEFAULT 0,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    is_frozen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Internal app wallet
CREATE TABLE IF NOT EXISTS app_wallet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    balance NUMERIC NOT NULL DEFAULT 0,
    btc_address TEXT,
    eth_address TEXT,
    usdt_address TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO app_wallet (id, balance) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'game_entry', 'game_win', 'game_loss', 'game_draw', 'cheat_forfeit')),
    amount NUMERIC NOT NULL,
    crypto_type TEXT CHECK (crypto_type IN ('btc', 'eth', 'usdt')),
    crypto_address TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL CHECK (mode IN ('bullet-1', 'blitz-3', 'blitz-5')),
    white_user_id UUID REFERENCES users(id),
    black_user_id UUID REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    result TEXT CHECK (result IN ('white', 'black', 'draw')),
    game_state_json JSONB,
    white_time_remaining INTEGER NOT NULL,
    black_time_remaining INTEGER NOT NULL,
    entry_fee NUMERIC NOT NULL,
    white_payout NUMERIC DEFAULT 0,
    black_payout NUMERIC DEFAULT 0,
    platform_fee NUMERIC DEFAULT 0,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_user_id);
CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_user_id);

-- Game escrow
CREATE TABLE IF NOT EXISTS game_escrow (
    game_id UUID PRIMARY KEY REFERENCES games(id),
    white_user_id UUID NOT NULL REFERENCES users(id),
    black_user_id UUID NOT NULL REFERENCES users(id),
    entry_fee NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    released_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_escrow_status ON game_escrow(status);

-- Game moves
CREATE TABLE IF NOT EXISTS game_moves (
    id SERIAL PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id),
    move_number INTEGER NOT NULL,
    from_square TEXT NOT NULL,
    to_square TEXT NOT NULL,
    piece_type TEXT NOT NULL,
    piece_color TEXT NOT NULL,
    captured_type TEXT,
    promotion_type TEXT,
    is_castling BOOLEAN,
    is_en_passant BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_moves_game ON game_moves(game_id);
