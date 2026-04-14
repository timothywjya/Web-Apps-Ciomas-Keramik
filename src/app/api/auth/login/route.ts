export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await queryOne<{
      id: string; username: string; email: string; full_name: string;
      role: string; password_hash: string; is_active: boolean;
    }>(
      'SELECT id, username, email, full_name, role, password_hash, is_active FROM users WHERE username = $1',
      [username]
    );

    if (!user) return NextResponse.json({ error: 'Username tidak ditemukan' }, { status: 401 });
    if (!user.is_active) return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 401 });

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Password salah' }, { status: 401 });

    // Update last login
    await queryOne('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
