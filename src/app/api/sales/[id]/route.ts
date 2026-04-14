export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sale = await queryOne(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
             u.full_name as salesperson_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.salesperson_id
      WHERE s.id = $1
    `, [id]);
    if (!sale) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });

    const items = await query(`
      SELECT si.*, p.name as product_name, p.sku, p.unit
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = $1
    `, [id]);

    return NextResponse.json({ sale, items });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const [sale] = await query(`
      UPDATE sales SET status=$1, payment_status=$2, paid_amount=$3, notes=$4, updated_at=NOW()
      WHERE id=$5 RETURNING *
    `, [body.status, body.payment_status, body.paid_amount || 0, body.notes || null, id]);

    return NextResponse.json({ sale });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui' }, { status: 500 });
  }
}
