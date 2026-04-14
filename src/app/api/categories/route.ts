export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY name ASC');
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil kategori' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json();
    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    const [cat] = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan kategori' }, { status: 500 });
  }
}
