export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { StockOpnameRepository } from '@/server/repositories/opname-dr.repository';
import { generateStockOpnameReportHTML } from '@/lib/pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const opname = await StockOpnameRepository.findById(id) as Record<string,unknown> | null;
    const items  = await StockOpnameRepository.findItems(id) as Record<string,unknown>[];
    if (!opname) return fail('Stock opname tidak ditemukan', 404);
    const html = generateStockOpnameReportHTML({
      opname: { opname_number: String(opname.opname_number), opname_date: String(opname.opname_date), status: String(opname.status), notes: String(opname.notes ?? ''), created_by_name: String(opname.created_by_name ?? ''), confirmed_by_name: String(opname.confirmed_by_name ?? ''), confirmed_at: String(opname.confirmed_at ?? ''), total_items: Number(opname.total_items), total_discrepancy: Number(opname.total_discrepancy) },
      items: items.map(i => ({ sku: String(i.sku ?? ''), product_name: String(i.product_name ?? ''), system_qty: Number(i.system_qty), physical_qty: i.physical_qty === null ? null : Number(i.physical_qty), difference: Number(i.difference ?? 0), unit_price: Number(i.unit_price ?? 0), notes: String(i.notes ?? ''), counted_by_name: String(i.counted_by_name ?? '') })),
    });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}
