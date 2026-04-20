export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { ReceivableRepository } from '@/server/repositories/ledger.repository';
import { dbQueryOne } from '@/server/repositories/base.repository';

// GET /api/receivables           → list piutang (filter: search, status)
// GET /api/receivables?summary=1 → ringkasan total piutang aktif
// POST /api/receivables          → buat piutang baru dari invoice penjualan

export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const sp = req.nextUrl.searchParams;

    if (sp.get('summary') === '1') {
      return ok({ summary: await ReceivableRepository.summary() });
    }

    const receivables = await ReceivableRepository.findAll({
      search: sp.get('search') ?? '',
      status: sp.get('status') ?? '',
    });
    return ok({ receivables });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'kasir');
    if (auth instanceof NextResponse) return auth;

    const { sale_id, due_date, discount_amount, notes } = await req.json();
    if (!sale_id) return fail('sale_id wajib diisi');

    // Cek duplikat
    const existing = await ReceivableRepository.findBySaleId(sale_id);
    if (existing) return fail('Piutang untuk invoice ini sudah ada');

    // Ambil data invoice — JOIN customer untuk denormalisasi
    const sale = await dbQueryOne<{
      id: string; invoice_number: string; sales_date: string;
      customer_id?: string; total_amount: number; payment_method: string;
    }>(`SELECT * FROM sales WHERE id = $1`, [sale_id]);
    if (!sale) return fail('Invoice tidak ditemukan', 404);

    if (sale.payment_method === 'cash') {
      return fail('Invoice cash tidak perlu dicatat sebagai piutang');
    }

    const receivable = await ReceivableRepository.create({
      sale_id,
      invoice_number : sale.invoice_number,
      invoice_date   : sale.sales_date,
      customer_id    : sale.customer_id,
      due_date       : due_date ?? null,
      total_amount   : sale.total_amount,
      discount_amount: discount_amount ?? 0,
      notes,
      created_by     : auth.id,
    });

    return ok({ receivable }, 201);
  });
}
