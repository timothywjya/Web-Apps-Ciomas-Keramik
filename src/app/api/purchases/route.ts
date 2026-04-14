export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession, generateInvoiceNumber } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    let sql = `
      SELECT p.*, s.name as supplier_name, u.full_name as created_by_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;
    if (search) {
      sql += ` AND (p.purchase_number ILIKE $${idx} OR s.name ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (status) { sql += ` AND p.status = $${idx}`; params.push(status); idx++; }
    sql += ' ORDER BY p.created_at DESC LIMIT 200';

    const purchases = await query(sql, params);
    return NextResponse.json({ purchases });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { supplier_id, items, notes, due_date } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Tambahkan minimal 1 produk' }, { status: 400 });
    }

    const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0);
    const purchaseNumber = generateInvoiceNumber('PO');

    const [purchase] = await query<{ id: string }>(`
      INSERT INTO purchases (purchase_number, supplier_id, purchase_date, due_date, status, subtotal, total_amount, notes, created_by)
      VALUES ($1, $2, CURRENT_DATE, $3, 'received', $4, $4, $5, $6)
      RETURNING id, purchase_number
    `, [purchaseNumber, supplier_id || null, due_date || null, subtotal, notes || null, session.id]);

    for (const item of items) {
      await query(`
        INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, subtotal, received_quantity)
        VALUES ($1, $2, $3, $4, $5, $3)
      `, [purchase.id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]);

      const product = await queryOne<{ stock_quantity: number; purchase_price: number }>(
        'SELECT stock_quantity, purchase_price FROM products WHERE id = $1', [item.product_id]
      );
      if (!product) continue;

      const qtyBefore = product.stock_quantity;
      const qtyAfter = qtyBefore + item.quantity;

      await query('UPDATE products SET stock_quantity = $1, purchase_price = $2, updated_at = NOW() WHERE id = $3',
        [qtyAfter, item.unit_price, item.product_id]);

      await query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, created_by)
        VALUES ($1, 'in', $2, $3, $4, 'purchase', $5, $6, $7)
      `, [item.product_id, item.quantity, qtyBefore, qtyAfter, purchase.id, `PO: ${purchaseNumber}`, session.id]);
    }

    return NextResponse.json({ purchase }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan pembelian' }, { status: 500 });
  }
}
