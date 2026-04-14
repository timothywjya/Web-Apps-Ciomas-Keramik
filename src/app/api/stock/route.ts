export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || '';
    const productId = searchParams.get('product_id') || '';

    let sql = `
      SELECT sm.*, p.name as product_name, p.sku, u.full_name as created_by_name
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (type) { sql += ` AND sm.movement_type = $${idx}`; params.push(type); idx++; }
    if (productId) { sql += ` AND sm.product_id = $${idx}`; params.push(productId); idx++; }
    sql += ' ORDER BY sm.created_at DESC LIMIT 300';

    const movements = await query(sql, params);
    return NextResponse.json({ movements });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { product_id, movement_type, quantity, notes } = await req.json();
    if (!product_id || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const product = await queryOne<{ stock_quantity: number }>(
      'SELECT stock_quantity FROM products WHERE id = $1', [product_id]
    );
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });

    const qtyBefore = product.stock_quantity;
    let qtyAfter: number;

    if (movement_type === 'in' || movement_type === 'return') {
      qtyAfter = qtyBefore + quantity;
    } else if (movement_type === 'out') {
      if (qtyBefore < quantity) return NextResponse.json({ error: 'Stok tidak mencukupi' }, { status: 400 });
      qtyAfter = qtyBefore - quantity;
    } else if (movement_type === 'adjustment') {
      qtyAfter = quantity; // set to exact value
    } else {
      return NextResponse.json({ error: 'Tipe tidak valid' }, { status: 400 });
    }

    await query('UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2', [qtyAfter, product_id]);

    const [movement] = await query(`
      INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7) RETURNING *
    `, [product_id, movement_type, quantity, qtyBefore, qtyAfter, notes || null, session.id]);

    return NextResponse.json({ movement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 });
  }
}
