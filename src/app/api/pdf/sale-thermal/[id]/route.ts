export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { SaleRepository } from '@/server/repositories/sale.repository';
import { generateThermalReceiptHTML } from '@/lib/pdf';
import { dbQueryOne } from '@/server/repositories/base.repository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const sale = await dbQueryOne<Record<string,unknown>>(
      `SELECT s.*, c.name AS customer_name, c.customer_type,
              u.full_name AS salesperson_name
       FROM sales s
       LEFT JOIN customers c ON c.id=s.customer_id
       LEFT JOIN users u ON u.id=s.salesperson_id
       WHERE s.id=$1`, [id]
    );
    if (!sale) return fail('Invoice tidak ditemukan', 404);
    const items = await SaleRepository.findItemsById(id);
    const html = generateThermalReceiptHTML({
      sale: { ...sale, invoice_number: String(sale.invoice_number), sales_date: String(sale.sales_date), payment_method: String(sale.payment_method), payment_status: String(sale.payment_status), subtotal: Number(sale.subtotal), discount_amount: Number(sale.discount_amount), tax_amount: Number(sale.tax_amount), total_amount: Number(sale.total_amount), paid_amount: Number(sale.paid_amount), salesperson_name: String(sale.salesperson_name ?? ''), customer_name: String(sale.customer_name ?? ''), notes: String(sale.notes ?? '') },
      items: items.map(i => ({ product_name: String(i.product_name ?? ''), sku: String(i.sku ?? ''), unit: String(i.unit ?? 'pcs'), quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount_percent: Number(i.discount_percent), subtotal: Number(i.subtotal) })),
    });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}
