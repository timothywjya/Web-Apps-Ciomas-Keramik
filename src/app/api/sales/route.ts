export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession, generateInvoiceNumber } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    let sql = `
      SELECT s.*, c.name as customer_name, u.full_name as salesperson_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.salesperson_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      sql += ` AND (s.invoice_number ILIKE $${idx} OR c.name ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (status) { sql += ` AND s.status = $${idx}`; params.push(status); idx++; }
    if (from) { sql += ` AND s.sales_date >= $${idx}`; params.push(from); idx++; }
    if (to) { sql += ` AND s.sales_date <= $${idx}`; params.push(to); idx++; }

    sql += ' ORDER BY s.created_at DESC LIMIT 200';
    const sales = await query(sql, params);
    return NextResponse.json({ sales });
  } catch (error) {
    console.error('Sales GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_id, items, payment_method, discount_amount, notes } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Tambahkan minimal 1 produk' }, { status: 400 });
    }

    // Calculate totals
    const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0);
    const totalAmount = subtotal - (discount_amount || 0);
    const invoiceNumber = generateInvoiceNumber('INV');

    // Create sale
    const [sale] = await query<{ id: string }>(`
      INSERT INTO sales (invoice_number, customer_id, sales_date, status, payment_method,
        payment_status, subtotal, discount_amount, total_amount, paid_amount, notes, salesperson_id, created_by)
      VALUES ($1, $2, CURRENT_DATE, 'pending', $3, 'unpaid', $4, $5, $6, 0, $7, $8, $8)
      RETURNING id
    `, [invoiceNumber, customer_id || null, payment_method || 'cash',
        subtotal, discount_amount || 0, totalAmount, notes || null, session.id]);

    // Create sale items and update stock
    for (const item of items) {
      const product = await queryOne<{ stock_quantity: number }>(
        'SELECT stock_quantity FROM products WHERE id = $1', [item.product_id]
      );
      if (!product) continue;

      const subtotalItem = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);

      await query(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_percent, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [sale.id, item.product_id, item.quantity, item.unit_price, item.discount_percent || 0, subtotalItem]);

      const qtyBefore = product.stock_quantity;
      const qtyAfter = qtyBefore - item.quantity;

      await query('UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2', [qtyAfter, item.product_id]);
      await query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, created_by)
        VALUES ($1, 'out', $2, $3, $4, 'sale', $5, $6)
      `, [item.product_id, item.quantity, qtyBefore, qtyAfter, sale.id, session.id]);
    }

    // Update customer total purchases
    if (customer_id) {
      await query('UPDATE customers SET total_purchases = total_purchases + $1 WHERE id = $2', [totalAmount, customer_id]);
    }

    return NextResponse.json({ sale, invoice_number: invoiceNumber }, { status: 201 });
  } catch (error) {
    console.error('Sales POST error:', error);
    return NextResponse.json({ error: 'Gagal membuat invoice' }, { status: 500 });
  }
}
