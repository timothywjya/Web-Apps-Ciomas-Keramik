export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    let sql = 'SELECT * FROM suppliers WHERE is_active = true';
    const params: unknown[] = [];
    if (search) {
      sql += ' AND (name ILIKE $1 OR contact_person ILIKE $1 OR phone ILIKE $1)';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name ASC';
    const suppliers = await query(sql, params);
    return NextResponse.json({ suppliers });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { name, contact_person, phone, email, address, city, notes } = body;
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

    const [supplier] = await query(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, city, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [name, contact_person || null, phone || null, email || null, address || null, city || null, notes || null]);

    return NextResponse.json({ supplier }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan supplier' }, { status: 500 });
  }
}
