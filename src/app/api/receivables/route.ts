export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { ReceivableRepository, type PaymentType } from '@/server/repositories/ledger.repository';
import { dbQueryOne } from '@/server/repositories/base.repository';

// GET  /api/receivables           → daftar piutang (filter: search, status)
// GET  /api/receivables?summary=1 → ringkasan total piutang aktif
// POST /api/receivables           → buat piutang dari invoice atau manual

const VALID_PAYMENT_TYPES: PaymentType[] = ['kredit', 'tempo', 'dp', 'cash'];

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

    const body = await req.json();
    const { sale_id, due_date, discount_amount, notes, payment_type } = body;

    // ── Mode A: Dari Invoice Sales ────────────────────────────────────────────
    if (sale_id) {
      const existing = await ReceivableRepository.findBySaleId(sale_id);
      if (existing) return fail('Piutang untuk invoice ini sudah ada');

      const sale = await dbQueryOne<{
        id: string; invoice_number: string; sales_date: string;
        customer_id?: string; total_amount: number; payment_method: string;
      }>(`SELECT * FROM sales WHERE id = $1`, [sale_id]);
      if (!sale) return fail('Invoice tidak ditemukan', 404);

      // Tentukan payment_type: dp (cash dengan DP), atau ikuti payment_method
      const resolvedType: PaymentType = (() => {
        if (payment_type && VALID_PAYMENT_TYPES.includes(payment_type)) {
          return payment_type as PaymentType;
        }
        if (sale.payment_method === 'kredit') return 'kredit';
        if (sale.payment_method === 'tempo')  return 'tempo';
        return 'cash'; // cash / transfer → piutang tipe cash (misal: DP belum lunas)
      })();

      const receivable = await ReceivableRepository.create({
        sale_id,
        invoice_number : sale.invoice_number,
        invoice_date   : sale.sales_date,
        customer_id    : sale.customer_id,
        due_date       : due_date  ?? null,
        payment_type   : resolvedType,
        total_amount   : sale.total_amount,
        discount_amount: discount_amount ?? 0,
        notes,
        created_by     : auth.id,
      });

      return ok({ receivable }, 201);
    }

    // ── Mode B: Manual (tanpa Sales Invoice) ──────────────────────────────────
    const {
      invoice_number, invoice_date, customer_id,
      total_amount,
    } = body;

    if (!invoice_number) return fail('invoice_number wajib untuk entri manual');
    if (!invoice_date)   return fail('invoice_date wajib untuk entri manual');
    if (!total_amount || total_amount <= 0) return fail('total_amount harus lebih dari 0');

    const resolvedType: PaymentType =
      VALID_PAYMENT_TYPES.includes(payment_type) ? payment_type : 'cash';

    const receivable = await ReceivableRepository.create({
      sale_id        : undefined,
      invoice_number,
      invoice_date,
      customer_id    : customer_id ?? null,
      due_date       : due_date    ?? null,
      payment_type   : resolvedType,
      total_amount   : Number(total_amount),
      discount_amount: Number(discount_amount ?? 0),
      notes,
      created_by     : auth.id,
    });

    return ok({ receivable }, 201);
  });
}
