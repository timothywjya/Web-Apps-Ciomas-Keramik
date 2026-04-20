export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { ReceivableRepository } from '@/server/repositories/ledger.repository';
import { SaleRepository } from '@/server/repositories/sale.repository';
import { generateReceivableStatementHTML } from '@/lib/pdf';

type Ctx = { params: Promise<{ id: string }> };

// GET  /api/receivables/:id        → detail + riwayat cicilan
// GET  /api/receivables/:id?pdf=1  → HTML statement untuk print/PDF
// POST /api/receivables/:id        → tambah cicilan pembayaran
// PATCH /api/receivables/:id       → update diskon

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const receivable = await ReceivableRepository.findById(id);
    if (!receivable) return fail('Piutang tidak ditemukan', 404);

    const payments = await ReceivableRepository.findPayments(id);

    if (req.nextUrl.searchParams.get('pdf') === '1') {
      const saleItems = await SaleRepository.findItemsById(receivable.sale_id);
      const html = generateReceivableStatementHTML({
        receivable,
        payments,
        sale_items: saleItems.map(i => ({
          product_name    : i.product_name    ?? '',
          sku             : i.sku             ?? '',
          quantity        : i.quantity,
          unit_price      : i.unit_price,
          discount_percent: i.discount_percent,
          subtotal        : i.subtotal,
        })),
      });
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return ok({ receivable, payments });
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager', 'kasir');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { amount, payment_date, payment_method, reference_no, notes } = await req.json();

    const { payment, receivable } = await ReceivableRepository.addPayment({
      receivable_id : id,
      amount        : Number(amount),
      payment_date  : payment_date ?? new Date().toISOString().split('T')[0],
      payment_method: payment_method ?? 'cash',
      reference_no,
      notes,
      created_by    : auth.id,
    });

    return ok({ payment, receivable });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { discount_amount } = await req.json();

    if (discount_amount === undefined || discount_amount < 0) {
      return fail('discount_amount tidak valid');
    }

    const receivable = await ReceivableRepository.updateDiscount(id, Number(discount_amount));
    return ok({ receivable });
  });
}
