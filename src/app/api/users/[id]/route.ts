export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();

    if (body.password) {
      const passwordHash = await hashPassword(body.password);
      await query(`
        UPDATE users SET full_name=$1, email=$2, role=$3, phone=$4, is_active=$5, password_hash=$6, updated_at=NOW()
        WHERE id=$7
      `, [body.full_name, body.email, body.role, body.phone || null, body.is_active !== false, passwordHash, id]);
    } else {
      await query(`
        UPDATE users SET full_name=$1, email=$2, role=$3, phone=$4, is_active=$5, updated_at=NOW()
        WHERE id=$6
      `, [body.full_name, body.email, body.role, body.phone || null, body.is_active !== false, id]);
    }

    const [user] = await query(
      'SELECT id, username, email, full_name, role, phone, is_active, last_login, created_at FROM users WHERE id=$1', [id]
    );
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (id === session.id) return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    await query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 });
  }
}
