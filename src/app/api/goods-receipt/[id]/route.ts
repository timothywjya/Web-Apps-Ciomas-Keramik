export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, handle } from '@/server/controllers/base.controller';
import { GoodsReceiptRepository } from '@/server/repositories/goods-receipt.repository';

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const gr    = await GoodsReceiptRepository.findById(id);
    const items = await GoodsReceiptRepository.findItems(id);
    return ok({ receipt: gr, items });
  });
}

export async function PATCH(req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'gudang');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { action } = await req.json();
    if (action === 'confirm') {
      await GoodsReceiptRepository.confirm(id, auth.id);
      return ok({ message: 'BPB dikonfirmasi, stok diperbarui' });
    }
    throw new Error('Action tidak dikenal');
  });
}
