export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, created, handle } from '@/server/controllers/base.controller';
import { GoodsReceiptRepository } from '@/server/repositories/goods-receipt.repository';
import { PurchaseRepository }     from '@/server/repositories/purchase.repository';
import { generateInvoiceNumber }  from '@/lib/auth';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const purchaseId = req.nextUrl.searchParams.get('purchase_id') ?? undefined;
    const data = await GoodsReceiptRepository.findAll(purchaseId);
    return ok({ receipts: data });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'gudang');
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    if (!body.purchase_id) throw new Error('purchase_id wajib diisi');
    // Fetch PO items untuk auto-populate
    const po = await PurchaseRepository.findById(body.purchase_id);
    if (!po) throw new Error('Purchase Order tidak ditemukan');
    const items = await PurchaseRepository.findItemsById(body.purchase_id);
    const grItems = (body.items ?? items.map((i: Record<string,unknown>) => ({
      purchase_item_id: i.id,
      product_id      : i.product_id,
      qty_ordered     : i.quantity,
      qty_received    : body.auto_fill ? i.quantity : 0,
      qty_damaged     : 0,
      unit_price      : i.unit_price,
    })));
    const gr = await GoodsReceiptRepository.create({
      purchase_id  : body.purchase_id,
      gr_number    : generateInvoiceNumber('BPB'),
      received_date: body.received_date ?? new Date().toISOString().split('T')[0],
      notes        : body.notes,
      created_by   : auth.id,
      items        : grItems,
    });
    return created({ receipt: gr });
  });
}
