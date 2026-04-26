export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { GoodsReceiptRepository } from '@/server/repositories/goods-receipt.repository';
import { generateGoodsReceiptHTML } from '@/lib/pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const gr    = await GoodsReceiptRepository.findById(id);
    const items = await GoodsReceiptRepository.findItems(id);
    if (!gr) return fail('BPB tidak ditemukan', 404);
    const html = generateGoodsReceiptHTML({
      gr: { gr_number: String(gr.gr_number), received_date: String(gr.received_date), status: String(gr.status), notes: String(gr.notes ?? ''), po_number: String(gr.po_number), supplier_name: String(gr.supplier_name ?? ''), supplier_phone: String(gr.supplier_phone ?? ''), created_by_name: String(gr.created_by_name ?? ''), confirmed_by_name: String(gr.confirmed_by_name ?? ''), confirmed_at: String(gr.confirmed_at ?? '') },
      items: items.map(i => ({ sku: String(i.sku ?? ''), product_name: String(i.product_name ?? ''), qty_ordered: Number(i.qty_ordered), qty_received: Number(i.qty_received), qty_damaged: Number(i.qty_damaged), unit_price: Number(i.unit_price), notes: String(i.notes ?? '') })),
    });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}
