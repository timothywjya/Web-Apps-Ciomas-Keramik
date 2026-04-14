export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    let sql = 'SELECT id, username, email, full_name, role, phone, is_active, last_login, created_at FROM users WHERE 1=1';
    const params: unknown[] = [];
    if (search) {
      sql += ' AND (full_name ILIKE $1 OR username ILIKE $1 OR email ILIKE $1)';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY created_at DESC';
    const users = await query(sql, params);
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang bisa menambah user' }, { status: 401 });
    }

    const body = await req.json();
    const { username, email, full_name, role, phone, password } = body;

    if (!username || !email || !full_name || !password) {
      return NextResponse.json({ error: 'Field wajib belum diisi' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing) return NextResponse.json({ error: 'Username atau email sudah digunakan' }, { status: 400 });

    const passwordHash = await hashPassword(password);
    const [user] = await query(`
      INSERT INTO users (username, email, password_hash, full_name, role, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, full_name, role, phone, is_active, created_at
    `, [username, email, passwordHash, full_name, role || 'kasir', phone || null]);

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan user' }, { status: 500 });
  }
}
