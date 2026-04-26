export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, ok, handle } from '@/server/controllers/base.controller';
import { PurchaseRepository } from '@/server/repositories/purchase.repository';

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const purchase = await PurchaseRepository.findById(id);
    if (!purchase) throw new Error('Purchase Order tidak ditemukan');
    const items = await PurchaseRepository.findItemsById(id);
    return ok({ purchase, items });
  });
}
