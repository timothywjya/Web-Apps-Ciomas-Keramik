export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    const existing = await queryOne<{ purchase_price: number; selling_price: number }>(
      'SELECT purchase_price, selling_price FROM products WHERE id = $1', [id]
    );
    if (!existing) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });

    // Log price history if price changed
    if (body.purchase_price !== existing.purchase_price || body.selling_price !== existing.selling_price) {
      await query(`
        INSERT INTO price_history (product_id, old_purchase_price, new_purchase_price, old_selling_price, new_selling_price, changed_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, existing.purchase_price, body.purchase_price, existing.selling_price, body.selling_price, session.id]);
    }

    const [product] = await query(`
      UPDATE products SET
        sku=$1, name=$2, category_id=$3, description=$4, unit=$5, size=$6,
        surface_type=$7, material=$8, color=$9, brand=$10, origin_country=$11,
        purchase_price=$12, selling_price=$13, grosir_price=$14, kontraktor_price=$15,
        min_stock=$16, is_active=$17, updated_at=NOW()
      WHERE id=$18 RETURNING *
    `, [
      body.sku, body.name, body.category_id || null, body.description || null,
      body.unit || 'pcs', body.size || null, body.surface_type || null,
      body.material || null, body.color || null, body.brand || null,
      body.origin_country || null, body.purchase_price || 0, body.selling_price || 0,
      body.grosir_price || null, body.kontraktor_price || null,
      body.min_stock || 10, body.is_active !== false, id
    ]);

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await query('UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json({ error: 'Gagal menghapus produk' }, { status: 500 });
  }
}
