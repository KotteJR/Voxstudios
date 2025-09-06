import { sql } from '@vercel/postgres';

function assertDatabaseEnvConfigured() {
  const hasPostgresVars = Object.keys(process.env).some((k) => k.startsWith('POSTGRES_'));
  if (!hasPostgresVars) {
    throw new Error('Database is not configured. Missing POSTGRES_* environment variables.');
  }
}

async function ensureExtensions() {
  // Ensure UUID generation is available
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
}

export async function ensureUsersTable() {
  assertDatabaseEnvConfigured();
  await ensureExtensions();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text UNIQUE NOT NULL,
      password_hash text,
      role text NOT NULL DEFAULT 'user',
      last_login timestamptz
    );
  `;
  
  // Add password_hash column if it doesn't exist (for existing tables)
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;`;
  } catch (error) {
    // Column might already exist, ignore error
    console.log('password_hash column already exists or error adding it:', error);
  }
}

export type DbUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  last_login: string | null;
};



