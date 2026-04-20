export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { PayableRepository } from '@/server/repositories/ledger.repository';
import { dbQueryOne } from '@/server/repositories/base.repository';

// GET  /api/payables           → daftar hutang (filter: search, status)
// GET  /api/payables?summary=1 → ringkasan total hutang aktif
// POST /api/payables           → buat hutang dari PO atau manual (rekapan pribadi)

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const sp = req.nextUrl.searchParams;

    if (sp.get('summary') === '1') {
      return ok({ summary: await PayableRepository.summary() });
    }

    const payables = await PayableRepository.findAll({
      search: sp.get('search') ?? '',
      status: sp.get('status') ?? '',
    });
    return ok({ payables });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { purchase_id, due_date, discount_amount, notes, ref_number } = body;

    // ── Mode A: Dari Purchase Order ───────────────────────────────────────────
    if (purchase_id) {
      const existing = await PayableRepository.findByPurchaseId(purchase_id);
      if (existing) return fail('Hutang untuk PO ini sudah ada');

      const po = await dbQueryOne<{
        id: string; purchase_number: string; purchase_date: string;
        supplier_id?: string; total_amount: number;
      }>(`SELECT * FROM purchases WHERE id = $1`, [purchase_id]);
      if (!po) return fail('Purchase Order tidak ditemukan', 404);

      const payable = await PayableRepository.create({
        purchase_id,
        po_number      : po.purchase_number,
        po_date        : po.purchase_date,
        supplier_id    : po.supplier_id,
        due_date       : due_date    ?? null,
        ref_number     : ref_number  ?? null,
        total_amount   : po.total_amount,
        discount_amount: Number(discount_amount ?? 0),
        notes,
        created_by     : auth.id,
      });

      return ok({ payable }, 201);
    }

    // ── Mode B: Manual — Rekapan Pribadi Ciomas ke Supplier ───────────────────
    const { po_number, po_date, supplier_id, total_amount } = body;

    if (!po_number)   return fail('po_number (nomor referensi) wajib untuk entri manual');
    if (!po_date)     return fail('po_date (tanggal) wajib untuk entri manual');
    if (!total_amount || Number(total_amount) <= 0) {
      return fail('total_amount harus lebih dari 0');
    }

    const payable = await PayableRepository.create({
      purchase_id    : undefined,
      po_number,
      po_date,
      supplier_id    : supplier_id ?? null,
      due_date       : due_date    ?? null,
      ref_number     : ref_number  ?? null,
      total_amount   : Number(total_amount),
      discount_amount: Number(discount_amount ?? 0),
      notes,
      created_by     : auth.id,
    });

    return ok({ payable }, 201);
  });
}
