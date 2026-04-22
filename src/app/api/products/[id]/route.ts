export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, handle } from '@/server/controllers/base.controller';
import { ProductRepository } from '@/server/repositories/product.repository';
import { dbQuery } from '@/server/repositories/base.repository';

type P = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const product = await ProductRepository.update(id, await req.json());
    return ok({ product });
  });
}

export async function DELETE(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    // Soft delete — set deleted_at and is_active=false
    await dbQuery(
      `UPDATE products SET deleted_at=NOW(), is_active=false, updated_at=NOW() WHERE id=$1`,
      [id]
    );
    return ok({ message: 'Produk dihapus (soft delete)' });
  });
}
