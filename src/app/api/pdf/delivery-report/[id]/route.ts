export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, fail, handle } from '@/server/controllers/base.controller';
import { DeliveryReportRepository } from '@/server/repositories/opname-dr.repository';
import { generateDeliveryReportHTML } from '@/lib/pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const report = await DeliveryReportRepository.findById(id) as Record<string,unknown> | null;
    const items  = await DeliveryReportRepository.findItems(id) as Record<string,unknown>[];
    if (!report) return fail('Berita acara tidak ditemukan', 404);
    const html = generateDeliveryReportHTML({
      report: { report_number: String(report.report_number), report_date: String(report.report_date), reference_number: String(report.reference_number), reference_type: String(report.reference_type), issue_type: String(report.issue_type), status: String(report.status), party_name: String(report.party_name ?? ''), party_type: String(report.party_type ?? ''), description: String(report.description ?? ''), resolution: String(report.resolution ?? ''), created_by_name: String(report.created_by_name ?? ''), resolved_by_name: String(report.resolved_by_name ?? ''), resolved_at: String(report.resolved_at ?? '') },
      items: items.map(i => ({ product_name: String(i.product_name ?? ''), sku: String(i.sku ?? ''), qty_expected: Number(i.qty_expected), qty_actual: Number(i.qty_actual), qty_damaged: Number(i.qty_damaged), issue_note: String(i.issue_note ?? '') })),
    });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
}
