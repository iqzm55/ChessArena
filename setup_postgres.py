# setup_postgres.py
import psycopg2
import bcrypt
import uuid
import os

# ================= CONFIG =================
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise SystemExit("DATABASE_URL is required. Set it before running setup_postgres.py")

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_UUID = os.getenv("ADMIN_ID", str(uuid.uuid4()))
# ==========================================

def get_hashed_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def main():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    print("Creating tables...")
    cursor.execute("""
    -- Users
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
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
        is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- App wallet
    CREATE TABLE IF NOT EXISTS app_wallet (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        balance NUMERIC NOT NULL DEFAULT 0,
        btc_address TEXT,
        eth_address TEXT,
        usdt_address TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    INSERT INTO app_wallet (id, balance)
    VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;

    -- Transactions
    CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'game_entry', 'game_win', 'game_loss', 'game_draw', 'cheat_forfeit')),
        amount NUMERIC NOT NULL,
        crypto_type TEXT CHECK (crypto_type IN ('btc','eth','usdt')),
        crypto_address TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

    -- Games
    CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('bullet-1','blitz-3','blitz-5')),
        white_user_id UUID REFERENCES users(id),
        black_user_id UUID REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
        result TEXT CHECK (result IN ('white','black','draw')),
        game_state_json TEXT,
        white_time_remaining INTEGER NOT NULL,
        black_time_remaining INTEGER NOT NULL,
        entry_fee NUMERIC NOT NULL,
        white_payout NUMERIC DEFAULT 0,
        black_payout NUMERIC DEFAULT 0,
        platform_fee NUMERIC DEFAULT 0,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        flagged BOOLEAN NOT NULL DEFAULT FALSE,
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
        status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded')),
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
        is_castling TEXT,
        is_en_passant BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_game_moves_game ON game_moves(game_id);
    """)

    # Commit table creation
    conn.commit()
    print("Tables created successfully!")

    # Insert admin
    print("Creating admin user...")
    hashed_password = get_hashed_password(ADMIN_PASSWORD)
    cursor.execute("""
    INSERT INTO users (id, username, password_hash, role, is_banned)
    VALUES (%s, %s, %s, 'admin', FALSE)
    ON CONFLICT (username) DO NOTHING;
    """, (ADMIN_UUID, ADMIN_USERNAME, hashed_password))
    conn.commit()
    print("Admin user inserted with UUID:", ADMIN_UUID)

    # Show tables and admin
    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public';")
    tables = cursor.fetchall()
    print("Tables in database:", tables)

    cursor.execute("SELECT id, username, role FROM users;")
    admin = cursor.fetchall()
    print("Admin users:", admin)

    cursor.close()
    conn.close()
    print("Database setup complete!")

if __name__ == "__main__":
    main()
