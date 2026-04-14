export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const active = searchParams.get('active');

    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (active) { sql += ` AND p.is_active = true`; }
    if (search) {
      sql += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.brand ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (category) {
      sql += ` AND p.category_id = $${idx}`;
      params.push(category); idx++;
    }
    sql += ' ORDER BY p.name ASC LIMIT 500';

    const products = await query(sql, params);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      sku, name, category_id, supplier_id, description, unit, size,
      surface_type, material, color, brand, origin_country, image_url,
      purchase_price, selling_price, grosir_price, kontraktor_price,
      stock_quantity, min_stock, max_stock, is_active
    } = body;

    if (!sku || !name) return NextResponse.json({ error: 'SKU dan nama wajib diisi' }, { status: 400 });

    const existing = await queryOne('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existing) return NextResponse.json({ error: 'SKU sudah digunakan' }, { status: 400 });

    const [product] = await query(`
      INSERT INTO products (sku, name, category_id, supplier_id, description, unit, size,
        surface_type, material, color, brand, origin_country, image_url,
        purchase_price, selling_price, grosir_price, kontraktor_price,
        stock_quantity, min_stock, max_stock, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [sku, name, category_id || null, supplier_id || null, description || null, unit || 'pcs',
        size || null, surface_type || null, material || null, color || null, brand || null,
        origin_country || null, image_url || null,
        purchase_price || 0, selling_price || 0, grosir_price || null, kontraktor_price || null,
        stock_quantity || 0, min_stock || 10, max_stock || 500, is_active !== false]);

    // Record initial stock
    if ((stock_quantity || 0) > 0) {
      await query(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, notes, created_by)
        VALUES ($1, 'in', $2, 0, $2, 'initial', 'Stok awal produk baru', $3)
      `, [product.id, stock_quantity, session.id]);
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan produk' }, { status: 500 });
  }
}
