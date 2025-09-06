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
  
  // Check if user exists and has password_hash
  const { rows } = await sql`SELECT password_hash FROM users WHERE email=${email}`;
  if (rows.length === 0) {
    // User doesn't exist, create it
    await sql`
      INSERT INTO users (name, email, role, password_hash)
      VALUES (${name}, ${email}, ${role}, ${passwordHash});
    `;
  } else if (!rows[0].password_hash) {
    // User exists but no password_hash, update it
    await sql`
      UPDATE users SET password_hash=${passwordHash} WHERE email=${email};
    `;
  }
}


