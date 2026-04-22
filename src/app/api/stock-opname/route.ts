export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, created, handle } from '@/server/controllers/base.controller';
import { StockOpnameRepository } from '@/server/repositories/opname-dr.repository';
import { generateInvoiceNumber } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const status = req.nextUrl.searchParams.get('status') ?? undefined;
    const data   = await StockOpnameRepository.findAll(status);
    return ok({ opnames: data });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'gudang');
    if (auth instanceof NextResponse) return auth;
    const body  = await req.json();
    const result = await StockOpnameRepository.createWithSnapshot({
      opname_number: generateInvoiceNumber('OPN'),
      opname_date  : body.opname_date ?? new Date().toISOString().split('T')[0],
      notes        : body.notes,
      created_by   : auth.id,
    });
    return created({ opname: result });
  });
}
