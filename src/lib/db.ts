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
      role text NOT NULL DEFAULT 'user',
      last_login timestamptz
    );
  `;
}

export type DbUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  last_login: string | null;
};



