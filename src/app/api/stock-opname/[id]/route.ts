export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, handle } from '@/server/controllers/base.controller';
import { StockOpnameRepository } from '@/server/repositories/opname-dr.repository';

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const opname = await StockOpnameRepository.findById(id);
    const items  = await StockOpnameRepository.findItems(id);
    return ok({ opname, items });
  });
}

// Update physical count for a single item
export async function PUT(req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'gudang');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body = await req.json();
    // id here is the opname_item_id, passed in body
    if (!body.item_id) throw new Error('item_id wajib diisi');
    await StockOpnameRepository.updateItemCount(body.item_id, body.physical_qty, body.notes ?? null, auth.id);
    return ok({ message: 'Hitungan diperbarui' });
  });
}

export async function PATCH(req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { action } = await req.json();
    if (action === 'confirm') {
      const result = await StockOpnameRepository.confirm(id, auth.id);
      return ok({ message: `Opname dikonfirmasi, ${result.adjusted} item disesuaikan` });
    }
    throw new Error('Action tidak dikenal');
  });
}
