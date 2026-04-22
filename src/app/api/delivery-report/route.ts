export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, ok, created, handle } from '@/server/controllers/base.controller';
import { DeliveryReportRepository } from '@/server/repositories/opname-dr.repository';
import { generateInvoiceNumber }    from '@/lib/auth';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const sp = req.nextUrl.searchParams;
    const data = await DeliveryReportRepository.findAll({
      status: sp.get('status') ?? undefined,
      reference_type: sp.get('reference_type') ?? undefined,
    });
    return ok({ reports: data });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'gudang', 'kasir');
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    if (!body.reference_type || !body.issue_type) throw new Error('reference_type dan issue_type wajib diisi');
    const dr = await DeliveryReportRepository.create({
      ...body,
      report_number: generateInvoiceNumber('BA'),
      report_date  : body.report_date ?? new Date().toISOString().split('T')[0],
      created_by   : auth.id,
    });
    return created({ report: dr });
  });
}
