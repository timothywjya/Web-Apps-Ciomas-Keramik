export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const [supplier] = await query(`
      UPDATE suppliers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, city=$6, notes=$7, is_active=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [body.name, body.contact_person || null, body.phone || null, body.email || null,
        body.address || null, body.city || null, body.notes || null, body.is_active !== false, id]);
    return NextResponse.json({ supplier });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await query('UPDATE suppliers SET is_active = false WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 });
  }
}
