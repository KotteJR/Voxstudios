import { sql } from '@vercel/postgres';
import * as bcrypt from 'bcryptjs';
import { ensureUsersTable } from '@/lib/db';

export async function seedAdmin() {
  await ensureUsersTable();
  const email = 'admintest';
  const name = 'Admin';
  const role = 'admin';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('demotest', salt);
  await sql`
    INSERT INTO users (name, email, role, password_hash)
    VALUES (${name}, ${email}, ${role}, ${passwordHash})
    ON CONFLICT (email) DO NOTHING;
  `;
}


