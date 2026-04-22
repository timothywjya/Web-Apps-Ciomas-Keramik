export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, handle } from '@/server/controllers/base.controller';
import { DeliveryReportRepository } from '@/server/repositories/opname-dr.repository';

type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const report = await DeliveryReportRepository.findById(id);
    const items  = await DeliveryReportRepository.findItems(id);
    return ok({ report, items });
  });
}

export async function PATCH(req: NextRequest, { params }: P) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const body   = await req.json();
    await DeliveryReportRepository.updateStatus(id, body.status, body.resolution ?? null, auth.id);
    return ok({ message: 'Status diperbarui' });
  });
}
