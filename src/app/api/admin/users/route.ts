import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import * as bcrypt from 'bcryptjs';
import { ensureUsersTable } from '@/lib/db';
import { seedAdmin } from './seed';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureUsersTable();
    await seedAdmin();
    const { rows } = await sql`SELECT id, name, email, role, last_login FROM users ORDER BY name ASC`;
    const users = rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, role: r.role, lastLogin: r.last_login }));
    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role, password } = body;
    await ensureUsersTable();
    let passwordHash: string | null = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }
    const { rows } = await sql`
      INSERT INTO users (name, email, role, password_hash) VALUES (${name}, ${email}, ${role || 'user'}, ${passwordHash})
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
      RETURNING id, name, email, role, last_login
    `;
    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role, password } = body;
    await ensureUsersTable();
    
    let query;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      query = sql`UPDATE users SET name=${name}, role=${role}, password_hash=${hash} WHERE id=${id} RETURNING id, name, email, role, last_login`;
    } else {
      query = sql`UPDATE users SET name=${name}, role=${role} WHERE id=${id} RETURNING id, name, email, role, last_login`;
    }
    
    const { rows } = await query;
    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    console.error('PUT /api/admin/users error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await ensureUsersTable();
    await sql`DELETE FROM users WHERE id=${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/users error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


