/**
 * Initialize database and optionally seed admin user.
 * Run: npx tsx scripts/init-db.ts
 */
import { getOne, query } from '../db/index.js';
import bcrypt from 'bcryptjs';

const adminId = process.env.ADMIN_ID || 'admin-' + Date.now();
const adminHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);

// Ensure app_wallet row exists
await query(`
  INSERT INTO app_wallet (id, balance) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING
`);

// Create default admin if no admin exists
const adminExists = await getOne<{ exists: number }>("SELECT 1 as exists FROM users WHERE role = 'admin' LIMIT 1");
if (!adminExists) {
  await query(`
    INSERT INTO users (id, username, password_hash, role)
    VALUES ($1, 'admin', $2, 'admin')
  `, [adminId, adminHash]);
  console.log('Created default admin user: admin / admin123');
}

console.log('Database initialized.');
