export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { PayableRepository } from '@/server/repositories/ledger.repository';
import { dbQueryOne } from '@/server/repositories/base.repository';

// GET /api/payables           → list hutang (filter: search, status)
// GET /api/payables?summary=1 → ringkasan total hutang aktif
// POST /api/payables          → buat hutang dari Purchase Order

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

    const { purchase_id, due_date, discount_amount, notes } = await req.json();
    if (!purchase_id) return fail('purchase_id wajib diisi');

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
      due_date       : due_date ?? null,
      total_amount   : po.total_amount,
      discount_amount: discount_amount ?? 0,
      notes,
      created_by     : auth.id,
    });

    return ok({ payable }, 201);
  });
}
