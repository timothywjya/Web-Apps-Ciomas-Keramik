export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { PurchaseRepository } from '@/server/repositories/purchase.repository';
import { generatePurchaseOrderHTML } from '@/lib/pdf';
import { dbQueryOne } from '@/server/repositories/base.repository';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const purchase = await dbQueryOne<{
      id: string; purchase_number: string; purchase_date: string; due_date?: string;
      status: string; subtotal: number; total_amount: number; paid_amount: number;
      notes?: string; created_by_name?: string;
      supplier_name?: string; supplier_phone?: string;
      supplier_email?: string; supplier_address?: string; supplier_city?: string;
    }>(`
      SELECT p.*,
             s.name    AS supplier_name,
             s.phone   AS supplier_phone,
             s.email   AS supplier_email,
             s.address AS supplier_address,
             s.city    AS supplier_city,
             u.full_name AS created_by_name
      FROM   purchases p
      LEFT   JOIN suppliers s ON s.id = p.supplier_id
      LEFT   JOIN users     u ON u.id = p.created_by
      WHERE  p.id = $1
    `, [id]);

    if (!purchase) return fail('Purchase Order tidak ditemukan', 404);

    const rawItems = await PurchaseRepository.findItemsById(id);

    const html = generatePurchaseOrderHTML({
      purchase,
      items: rawItems.map(i => ({
        sku         : (i as { sku?: string }).sku ?? '',
        product_name: i.product_name ?? '',
        quantity    : i.quantity,
        unit_price  : i.unit_price,
        subtotal    : i.subtotal,
      })),
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}
