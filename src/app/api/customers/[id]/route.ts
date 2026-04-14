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

    const [customer] = await query(`
      UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, city=$5,
        customer_type=$6, notes=$7, is_active=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [body.name, body.phone || null, body.email || null, body.address || null,
        body.city || null, body.customer_type || 'retail', body.notes || null,
        body.is_active !== false, id]);

    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await query('UPDATE customers SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 });
  }
}
