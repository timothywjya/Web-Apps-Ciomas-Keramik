export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';

    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (search) {
      sql += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (type) { sql += ` AND customer_type = $${idx}`; params.push(type); idx++; }
    sql += ' ORDER BY name ASC LIMIT 300';

    const customers = await query(sql, params);
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { name, phone, email, address, city, customer_type, notes } = body;
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

    const [customer] = await query(`
      INSERT INTO customers (name, phone, email, address, city, customer_type, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [name, phone || null, email || null, address || null, city || null, customer_type || 'retail', notes || null]);

    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan pelanggan' }, { status: 500 });
  }
}
