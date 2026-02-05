import { randomUUID } from 'crypto';
import { getOne, run } from '../db/index.js';
import type { UserRow } from '../db/index.js';

interface CreateUserInput {
  username: string;
  passwordHash: string;
}

export async function getUserByUsername(username: string): Promise<UserRow | undefined> {
  return getOne<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  return getOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const id = `player-${randomUUID()}`;
  await run(
    `
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, 'player', NOW(), NOW())
    `,
    [id, input.username, input.passwordHash]
  );
  return id;
}
