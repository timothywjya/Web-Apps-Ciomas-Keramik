export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAuth, ok, fail, handle } from '@/server/controllers/base.controller';
import { PayableRepository } from '@/server/repositories/ledger.repository';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const payable = await PayableRepository.findById(id);
    if (!payable) return fail('Hutang tidak ditemukan', 404);

    const payments = await PayableRepository.findPayments(id);
    return ok({ payable, payments });
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const auth = await requireRole('admin', 'manager');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { amount, payment_date, payment_method, reference_no, notes } = await req.json();

    const { payment, payable } = await PayableRepository.addPayment({
      payable_id    : id,
      amount        : Number(amount),
      payment_date  : payment_date ?? new Date().toISOString().split('T')[0],
      payment_method: payment_method ?? 'transfer',
      reference_no,
      notes,
      created_by    : auth.id,
    });

    return ok({ payment, payable });
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

    const payable = await PayableRepository.updateDiscount(id, Number(discount_amount));
    return ok({ payable });
  });
}
