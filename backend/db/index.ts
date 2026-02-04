import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_PATH || process.env.DATABASE_URL || join(__dirname, 'chesscrypto.db');

function getSchemaPath(): string {
  const distPath = join(__dirname, 'schema.sql');
  if (existsSync(distPath)) return distPath;
  return resolve(process.cwd(), 'db', 'schema.sql');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schema = readFileSync(getSchemaPath(), 'utf-8');
    db.exec(schema);
    applyMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'player';
  display_name: string | null;
  avatar_url: string | null;
  wallet_balance: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_draw: number;
  total_earnings: number;
  is_banned: number;
  is_frozen: number;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'game_entry' | 'game_win' | 'game_loss' | 'game_draw' | 'cheat_forfeit';
  amount: number;
  crypto_type: string | null;
  crypto_address: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
};

export type GameRow = {
  id: string;
  mode: string;
  white_user_id: string | null;
  black_user_id: string | null;
  status: string;
  result: string | null;
  game_state_json: string | null;
  white_time_remaining: number;
  black_time_remaining: number;
  entry_fee: number;
  white_payout: number | null;
  black_payout: number | null;
  platform_fee: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  flagged: number;
  flag_reason: string | null;
};

export type AppWalletRow = {
  id: number;
  balance: number;
  btc_address: string | null;
  eth_address: string | null;
  usdt_address: string | null;
  updated_at: string;
};

function applyMigrations(db: Database.Database): void {
  const hasColumn = (table: string, column: string) => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.some((r) => r.name === column);
  };

  if (!hasColumn('users', 'display_name')) {
    db.prepare("ALTER TABLE users ADD COLUMN display_name TEXT").run();
  }
  if (!hasColumn('users', 'avatar_url')) {
    db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  }
  if (!hasColumn('users', 'total_earnings')) {
    db.prepare("ALTER TABLE users ADD COLUMN total_earnings REAL NOT NULL DEFAULT 0").run();
  }

  if (!hasColumn('games', 'white_payout')) {
    db.prepare("ALTER TABLE games ADD COLUMN white_payout REAL DEFAULT 0").run();
  }
  if (!hasColumn('games', 'black_payout')) {
    db.prepare("ALTER TABLE games ADD COLUMN black_payout REAL DEFAULT 0").run();
  }
  if (!hasColumn('games', 'platform_fee')) {
    db.prepare("ALTER TABLE games ADD COLUMN platform_fee REAL DEFAULT 0").run();
  }

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='game_escrow'").all();
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_escrow (
        game_id TEXT PRIMARY KEY REFERENCES games(id),
        white_user_id TEXT NOT NULL REFERENCES users(id),
        black_user_id TEXT NOT NULL REFERENCES users(id),
        entry_fee REAL NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        released_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_game_escrow_status ON game_escrow(status);
    `);
  }

  const txSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get() as { sql?: string } | undefined;
  if (txSql?.sql && !txSql.sql.includes("'game_entry'")) {
    db.exec(`
      ALTER TABLE transactions RENAME TO transactions_old;
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'game_entry', 'game_win', 'game_loss', 'game_draw', 'cheat_forfeit')),
        amount REAL NOT NULL,
        crypto_type TEXT CHECK (crypto_type IN ('btc', 'eth', 'usdt')),
        crypto_address TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        processed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      INSERT INTO transactions (id, user_id, type, amount, crypto_type, crypto_address, status, created_at, processed_at)
      SELECT id, user_id, type, amount, crypto_type, crypto_address, status, created_at, processed_at FROM transactions_old;
      DROP TABLE transactions_old;
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);
  }
}
