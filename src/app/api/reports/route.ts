export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sales_summary';
    const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to = searchParams.get('to') || new Date().toISOString().split('T')[0];

    let data;

    if (type === 'sales_summary') {
      data = await query(`
        SELECT 
          TO_CHAR(s.sales_date, 'YYYY-MM-DD') as date,
          COUNT(s.id) as transactions,
          COALESCE(SUM(s.total_amount), 0) as revenue,
          COALESCE(SUM(s.discount_amount), 0) as discount
        FROM sales s
        WHERE s.sales_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
        GROUP BY s.sales_date
        ORDER BY s.sales_date ASC
      `, [from, to]);
    } else if (type === 'product_sales') {
      data = await query(`
        SELECT p.name, p.sku, c.name as category,
          SUM(si.quantity) as total_qty,
          SUM(si.subtotal) as total_revenue
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        JOIN sales s ON s.id = si.sale_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE s.sales_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
        GROUP BY p.id, p.name, p.sku, c.name
        ORDER BY total_revenue DESC
        LIMIT 50
      `, [from, to]);
    } else if (type === 'customer_sales') {
      data = await query(`
        SELECT c.name, c.customer_type, c.phone,
          COUNT(s.id) as transactions,
          SUM(s.total_amount) as total_spend
        FROM sales s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.sales_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
        GROUP BY c.id, c.name, c.customer_type, c.phone
        ORDER BY total_spend DESC
        LIMIT 50
      `, [from, to]);
    } else if (type === 'monthly') {
      data = await query(`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', sales_date), 'Mon YYYY') as month,
          COUNT(id) as transactions,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM sales
        WHERE sales_date >= NOW() - INTERVAL '12 months' AND status != 'cancelled'
        GROUP BY DATE_TRUNC('month', sales_date)
        ORDER BY DATE_TRUNC('month', sales_date) ASC
      `);
    }

    return NextResponse.json({ data, from, to, type });
  } catch (err) {
    console.error('Reports error:', err);
    return NextResponse.json({ error: 'Gagal mengambil laporan' }, { status: 500 });
  }
}
