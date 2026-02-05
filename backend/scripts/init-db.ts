/**
 * Initialize database schema and seed defaults.
 * Run: npx tsx scripts/init-db.ts
 */
import { getDb, closeDb } from '../db/index.js';

await getDb();
await closeDb();
console.log('Database initialized.');
