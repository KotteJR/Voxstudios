import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import * as bcrypt from 'bcryptjs';
import { ensureUsersTable } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    await ensureUsersTable();
    const { rows } = await sql`SELECT id, name, email, role, password_hash FROM users WHERE email=${email}`;
    const user = rows[0];
    if (!user || !user.password_hash) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    await sql`UPDATE users SET last_login=NOW() WHERE id=${user.id}`;
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error('POST /api/auth error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}


