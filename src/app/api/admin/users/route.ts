import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const users = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.user_metadata as any)?.role || 'user',
      name: (u.user_metadata as any)?.name || u.email,
      lastLogin: u.last_sign_in_at || u.created_at,
    }));
    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role } = body;
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: role || 'user' },
    });
    if (error) throw error;
    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role } = body;
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.updateUserById(id, { user_metadata: { name, role } });
    if (error) throw error;
    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error('PUT /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const admin = supabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}


