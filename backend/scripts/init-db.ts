/**
 * Initialize database and optionally seed admin user.
 * Run: npx tsx scripts/init-db.ts
 */
import { getDb } from '../db/index.js';
import bcrypt from 'bcryptjs';

const db = getDb();

// Ensure app_wallet row exists
db.prepare(`
  INSERT OR IGNORE INTO app_wallet (id, balance) VALUES (1, 0)
`).run();

// Create default admin if no admin exists (password: admin123)
const adminExists = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const adminId = 'admin-' + Date.now();
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (id, username, password_hash, role)
    VALUES (?, 'admin', ?, 'admin')
  `).run(adminId, hash);
  console.log('Created default admin user: admin / admin123');
}

console.log('Database initialized.');
