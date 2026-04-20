export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { SaleRepository } from '@/server/repositories/sale.repository';
import { generateSaleInvoiceHTML } from '@/lib/pdf';
import { dbQueryOne } from '@/server/repositories/base.repository';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const sale = await dbQueryOne<{
      id: string; invoice_number: string; sales_date: string; due_date?: string;
      status: string; payment_method: string; payment_status: string;
      subtotal: number; discount_amount: number; tax_amount: number;
      total_amount: number; paid_amount: number; notes?: string;
      salesperson_name?: string; customer_name?: string; customer_phone?: string;
      customer_address?: string; customer_city?: string;
    }>(`
      SELECT s.*,
             c.name    AS customer_name,
             c.phone   AS customer_phone,
             c.address AS customer_address,
             c.city    AS customer_city,
             u.full_name AS salesperson_name
      FROM   sales s
      LEFT   JOIN customers c ON c.id = s.customer_id
      LEFT   JOIN users     u ON u.id = s.salesperson_id
      WHERE  s.id = $1
    `, [id]);

    if (!sale) return fail('Invoice tidak ditemukan', 404);

    const items = await SaleRepository.findItemsById(id);

    const html = generateSaleInvoiceHTML({
      sale,
      items: items.map(i => ({
        sku             : i.sku            ?? '',
        product_name    : i.product_name   ?? '',
        unit            : i.unit           ?? 'pcs',
        quantity        : i.quantity,
        unit_price      : i.unit_price,
        discount_percent: i.discount_percent,
        subtotal        : i.subtotal,
      })),
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}
