export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, ok, handle } from '@/server/controllers/base.controller';
import { UserController } from '@/server/controllers/user.controller';
import { dbQuery } from '@/server/repositories/base.repository';

type P = { params: Promise<{ id: string }> };

export const PUT = (req: NextRequest, { params }: P) =>
  params.then(p => UserController.update(req, p.id));

export async function DELETE(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    // Soft delete
    await dbQuery(
      `UPDATE users SET deleted_at=NOW(), is_active=false, updated_at=NOW() WHERE id=$1`,
      [id]
    );
    return ok({ message: 'Pengguna dihapus (soft delete)' });
  });
}
