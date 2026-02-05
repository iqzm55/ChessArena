// backend/db/index.ts
import 'dotenv/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build DATABASE_URL dynamically for local dev if not provided
 */
let DATABASE_URL = process.env.DATABASE_URL ?? process.env.DATABASE_PUBLIC_URL;
if (!DATABASE_URL) {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const name = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !port || !name || !user || !password) {
    throw new Error(
      'Database credentials are missing! Set DATABASE_URL (or DATABASE_PUBLIC_URL) for production or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT for local development.'
    );
  }

  DATABASE_URL = `postgres://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false } // Railway requires SSL
      : undefined,
});

let initPromise: Promise<void> | null = null;

function getSchemaPath(): string {
  const distPath = join(__dirname, 'schema.sql');
  if (existsSync(distPath)) return distPath;
  return resolve(process.cwd(), 'db', 'schema.sql');
}

async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const schemaPath = getSchemaPath();
    if (!existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const schema = readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    await seedDefaults();
  })();

  return initPromise;
}

async function seedDefaults(): Promise<void> {
codex/fix-and-complete-chessarena-project-gsxl0a
  await pool.query('UPDATE users SET is_banned = FALSE');

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD ?? 'changeme123';
  const defaultHash = bcrypt.hashSync(defaultPassword, 10);
  await pool.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE password_hash IS NULL
         OR password_hash = ''
         OR password_hash NOT LIKE '$2%'
    `,
    [defaultHash]
  );

=======
main
  const adminExists = await pool.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (adminExists.rowCount && adminExists.rowCount > 0) {
    return;
  }

  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim() || 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const passwordHash =
    process.env.ADMIN_PASSWORD_HASH ?? bcrypt.hashSync(password, 10);
  const adminId = process.env.ADMIN_ID ?? `admin-${randomUUID()}`;

  await pool.query(
    `
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, 'admin', NOW(), NOW())
    `,
    [adminId, username, passwordHash]
  );
  console.log(`Seeded default admin user: ${username}`);
}

export async function getDb(): Promise<Pool> {
  await initDb();
  return pool;
}

export async function query<T extends QueryResultRow = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await initDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pool.query<T>(text, params as any[]);
}

export async function getOne<T extends QueryResultRow = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const res = await query<T>(text, params);
  return res.rows[0];
}

export async function getAll<T extends QueryResultRow = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}

export async function run(
  text: string,
  params: unknown[] = []
): Promise<{ rowCount: number | null | undefined }> {
  const res = await query(text, params);
  return { rowCount: res.rowCount };
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await initDb();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// ===== Types =====
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
  is_banned: boolean;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type:
    | 'deposit'
    | 'withdrawal'
    | 'game_entry'
    | 'game_win'
    | 'game_loss'
    | 'game_draw'
    | 'cheat_forfeit';
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
  flagged: boolean;
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
